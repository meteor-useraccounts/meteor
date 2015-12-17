# Introduction

These are the stories that motivate the design of the accounts system.
Although a particular app might not support all of these stories and some
stories might be even be incompatible with each other, the accounts system
itself should allow an app to support any combination of mutually compatible
stories.

## Terminology

### End-User

A person using the app, whether or not he has an account or any identities.
In End-User Stories, this person is just referred to as the "user".

### Client

The browser or device that the end-user is accessing the application from.

### Identity

Who a user is, according to some identity service. A user may have multiple
identities. The accounts system does not know if a user has an identity until an
identity service provides one. Normally when we refer to user having one or more
identities, we are referring to the identities that the accounts system are
aware of.

### Identity Service

A service that the accounts system can use to allow an end-user to authenticate
himself as having an identity. An identity service might also provide access to
additional information or services associated with the end-user's identity
(e.g. user's name and email, or ability to create a social media post).
An identity services might also provide a way for the accounts system to create
a new identity (e.g. `accounts-password`). An identity service might be
implemented entirely within Meteor (e.g. `accounts-password`) or it might use an
external service (e.g. `google`).

### External Service

A service that an identity service uses to authenticate an end-user and/or
create identities. Examples include OAuth services provided by Google, Facebook,
etc. As well as non-OAuth services provided by some client platforms like a
fingerprint-based authentication service.

### Authentication

The process by which an end-user proves to an identity service that he has a
particular identity. This typically involves presenting credentials to the
identity service or the external service.

### Credentials

The proof required by an identity service or an external service in order to
authenticate that an end-user has a particular identity.
For `accounts-password`, this is a username or email and a password.
For `accounts-google`, if the user is already signed into to Google, this is a
token stored in the end-user's client; otherwise it is the end-user's Google
email and password possibly along with other information like an authentication
code.

### Account

An application object that is associated with one or more identities of a
particular end-user. There is at most one account associated with any identity.

### Logging In

The process by which an end-user uses one of his identities to gain access to
an account. Once this occurs, `Meteor.userId()` returns a unique identifier for
the account associated with the identity that the user used; and
`Meteor.user()` returns the account object itself.

### Guest Identity

An identity created for and possessed by an end-user, but for which the end-user
does not generally have access to credentials that would allow him to
authenticate as this identity from another client.

### Guest Account

An account for which the only associated identity is a guest identity.

### Guest User

An end-user who is logged into a guest account.

### Anonymous User

An end-user who is not logged into any account, not even a guest account.

### Registered Account

An account that it is associated with at least one non-guest identity and
contains any other user information required by the application.

### Registration

The process of creating a registered account or updating an account so that it
is a registered account.

# End-User Stories

The end-user has the following characteristics:

* he might not remember whether he already has an account and/or which
service(s) he has associated with the account

* he wants to be able to sign-up for an account if he doesn't have one

* he wants to be able to sign-in to any accounts he has

* he wants to avoid accidentally creating multiple accounts in the app

* he might want to intentionally create multiple accounts (e.g. a separate one
for administration)

* he might prefer to use or not use a particular identity service to
sign-in/sign-up. For example, he might prefer to not establish a password with
the app or he might prefer to not reveal his email address to the app.


* he might want to be able to sign-in to the same account using multiple
identity services. This can make signing-in more convenient, and provide a
backup if he becomes unable to authenticate with one identity service (e.g.
forgot password, or external account deleted). It can also make it easier for
him to share information between the app and external services (e.g. sharing
app data with others, or importing personal information from the external
service into the app).

To avoid a lot of repetition, I'm structuring the stories in terms of the
behavior various end-user actions should have in various end-user states. First
I'll describe the states and the actions available from them, and then I'll
describe the behavior of the actions themselves.

## End-User States

### Anonymous

The user is an [anonymous user](#anonymous-user). This state does not exist in
apps that automatically log users in to guest accounts. In this state the app
provides some subset of the following actions:

* Sign In with Service X

* Sign Up with Service X

* Sign In/Up with Service X

* Sign In as Guest.

### Guest

The user is a [guest user](#guest-user). As a result, the app provides some
subset of the following actions:

* Sign In with Service X

* Sign Up with Service X

* Sign In/Up with Service X

* Delete Account

* Merge Account Associated with Service X.

#### Guest without Data

A substate of [Guest](#guest) where the user has not associated any data with
the account.

#### Guest with Data

A substate of [Guest](#guest) where the user has associated some data with the
account.

### Signed Up

The user is [logged in](#logging-in) to a [regisered
account](#registered-account). As a result, and app provides some subset of the
following actions:

* Add Service X

* Remove Service X

* Sign Out

* Delete Account

* Switch User with Service X

* Merge Account Associated with Service X.

If there are multiple identity services, the app probably won't provide Switch
User with Service X, opting instead to have the user first choose Sign Out, and
then Sign In/Up with Service X. If there is only one identity service, the app
won't provide Add Service X and Remove Service X but is more likely to offer a
Switch User action. Also, the app may not offer the Add Service X action for
services where the user already has an identity associated with the account, nor
will it offer the Delete Service X action for services where the user does not
have an identity associated with the account. It will also not offer any Delete
Service X actions if there is only one identity associated with the account.

## Internal Actions

These actions aren't directly initiated by the user, but are used by other
actions that the user can initiate and they typically involve user interaction.

### Create Identity with Service X

This action can result in the user having an identity associated with service X
(i.e. he has successfully authenticated with service X), even though the user
might not be able to use the identity to sign-in to an account yet. This action
can only be run if the identity service for service X supports identity
creation.

The app gathers any credentials required (e.g. user's requested
username/email/password) and initiates the identity creation process. If during
the identity creation process, the user attempts to create an identity which
conflicts with an existing identity, this action ends and the conflict is
reported to the calling action. Other errors associated with identity creation
are reported to the user who can either take corrective action or cancel the
identity creation. If the user cancels the identity creation, the initiating
action is canceled and the user's state remains unchanged. If an identity is
successfully created it, that is reported to the calling action.

The identity creation process might:

* redirect the client to a new page, causing the app to reload. The reloaded app
should allow the user to continue whatever action was in process.

* require the user to follow a link and the user might do that in a different
client than the one where the process started. After following
the link, the user should be able to continue whatever action was in process
from the new client. Under some circumstances (e.g. user never follows
a link), an identity service might never report the outcome of the identity
creation. However, whenever the outcome is reported, it can
be reported to have either succeeded or failed. 

### Authenticate with Service X

This action can result in the user having an identity associated with service X
(i.e. he has successfully authenticated with service X), even though the user
might not be able to use the identity to sign-in to an account yet.

If the user already has a identity associated with service X a successful
outcome is reported.

Otherwise, the app passes the information that the user has already provided
(e.g. password) to the identity service for service X. The identity service uses
that information and/or requires the user to take additional action (e.g.
sign-in to an external service that support OAuth, or follow a link in an email
or SMS) to authenticate the user. The identity service might also allow the user
to register with an external service before authenticating and/or require that
the user give the app permission to access his account on the external service.

The authentication process might:

* redirect the client to a new page, causing the app to reload. The reloaded app
should allow the user to continue whatever action was in process.

* require the user to follow a link and the user might do that in a different
client than the one where the process started. After following
the link, the user should be able to continue whatever action was in process
from the new client. Under some circumstances (e.g. user never follows
a link), an identity service might never report the outcome of the
authentication. However, whenever the outcome is reported, it can
be reported to have either succeeded or failed. 

### Login to Account

This action can only be called if the user has an identity that is associated
with an existing account.

If the user is not a Guest with Data, he is logged in to the account and his
state is changed to Signed Up.

If the user is a Guest with Data, he sees something like "What should we do with
your guest account? [Delete It and Sign-In] [Keep It and Cancel Sign-In] [Merge
It]". If he chooses "Delete it and Sign-In", his guest account is deleted, he is
logged in to the other account, and the calling action continues. If he chooses
"Merge It", the user's guest account and the other account are merged in an
app-specific manner (potentially with user input), the user is logged in to the
merged account, and as a result his state is Signed Up.

### Register User with Service X

If the user is Signed Up, this action does nothing.

Otherwise, the app attempts to gathers any necessary registration information
from the service. If the app requires additional registration information, the
user sees something like "Please provide the following additional information to
complete your registration...". If the user does not provide the required
information, the sign-up is canceled and the user's state remains unchanged. If
he does provide the required information, it is added to his guest account if he
is a Guest, or a new account if he is not. In either case, he can sign-in to the
account using service X in future, and his state is changed to Signed Up.

## End-User Actions

These are actions that are initiated by the end-user.

### Sign In with Service X

The app runs the Authenticate with Service X action.

If the authentication fails, the user sees something like "Sign-in Failed" and
his state remains unchanged.

If the authentication succeeds and there is an existing app account for the
resulting identity, the Login to Account action is run.

If the authentication succeeds but there is not an existing app account for the
resulting identity, the user's state remains unchanged and the user sees
something like "You don't yet have an account in this application associated
your X identity. Would you like to sign up using that identity, or try a
different identity?". If the users chooses the "sign up" option, the Register
User with Service X action is run.

### Sign Up with Service X

If the identity service for service X supports identity creation, the app runs
the Create Identity with Service X action. 

* If the identity is created successfully, the Register User with Service X
action is run.  
  
* If it fails due to a conflicting account, the user is asked whether he wants
to sign-in to the conflicting account. If he does not, his state remains
unchanged and the calling action is canceled. Otherwise the Sign In with
Service X action is run.  

If the identity service for service X does not support identity creation, the
app runs the Authenticate with Service X action and handles it's outcome as
follows:

If the authentication fails, the user sees something like "Sign-in Failed", his
state remains unchanged, and the sign-up is canceled.

If the authentication succeeds and there is an existing app account for the
resulting identity, the Login to Account action is run.

If the authentication succeeds but there is not an existing app account for the
resulting identity, the Register User with Service X action is run.

### Sign In/Up with Service X

An app should only offer this action when the user can only use one identity
service.

The app runs the Authenticate with Service X action.

If the authentication fails, and the identity service for service X does not
support identity creation then the user sees something like "Sign-in Failed" and
his state remains unchanged.

If the authentication fails, and the identity service for service X supports
identity creation, the app runs the Create Identity with Service X action. 

* If the identity is created successfully, the Register User with Service X
action is run.  
  
* If it fails due to a conflicting account, the user is asked whether he wants
to sign-in to the conflicting account. If he does not, his state remains
unchanged and the calling action is canceled. Otherwise the Sign In with
Service X action is run.  

If the authentication succeeds and there is an existing app account for the
resulting identity, then the Login to Account action is run.

If the authentication succeeds but there is not an existing app account for the
resulting identity, the Register User with Service X action is run.

### Sign In as Guest

The app creates a new guest identity for the user, associates a new guest
account, and logs the user into that account. The user's state becomes Guest
without Data.

### Delete Account

The user is logged out and his account is deleted. His new state becomes
Anonymous.

### Sign Out

The user is logged out of his account (but his account remains). His new state
becomes Anonymous.

### Switch User with Service X

This is equivalent to Sign In with Service X, but is only available when the
user is in the Signed Up state.

### Merge Account Associated with Service X

The app runs the Authenticate with Service X action.

If the authentication fails, the user sees something like "Sign-in Failed" and
his state remains unchanged.

If the authentication succeeds but there is not an existing app account for the
resulting identity, the user sees something like "No such account", the action
ends, and his state remains unchanged.

If the authentication succeeds and there is an existing registered account for
the resulting identity, the user's current account and the existing account are
merged in an app-specific manner (potentially with user input), the user is
logged in to the merged account, and as a result his state is Signed Up.

### Add Service X

If the identity service for service X supports identity creation, the app runs
the Create Identity with Service X action. 

* If the identity is created successfully, it is associated with the user's
current account and the user can sign-in to his current account using service
X in the future.
  
* If it fails due to a conflicting account, the user is asked whether he wants
to merge the conflicting account. If he does not, his state remains unchanged
and the calling action is canceled. Otherwise the Merge Account Associated
with Service X action is run.   

If the identity service for service X does not support identity creation, the
app runs the Authenticate with Service X action and handles it's outcome as
follows:

If the authentication fails, the user sees something like "Sign-in Failed", his
state remains unchanged, and the action is canceled.

If the authentication succeeds and there is an existing app account for the
resulting identity, the user is asked whether he wants to merge the conflicting
account. If he does not, his state remains unchanged and the calling action is
canceled. Otherwise the Merge Account Associated with Service X action is run.   

If the authentication succeeds and there is not an existing app account for the
resulting identity, the identity is associated with the user's current account
and the user can sign-in to his current account using service X in the future.

### Remove Service X

The user becomes unable to login to his current account using his service X
identity.

# Developer Stories

The application developer has the following concerns:

* Account creation policy: He might want to control which end-users can create
accounts under which circumstances (e.g. only admins, only on connections from
the intranet, or no one)

* Sign-in policy: He might want to control under what circumstances an end-user
can sign-in to a particular account (e.g. only via an LDAP service when logging
in from the intranet)

* He might want to control which end-users can insert records of any kind into
the database (e.g. to prevent DoS attacks)

The identity service developer has the following concerns:

* When using an external service, that service might provide it's own UI that
asks the end-user whether he wants to create an account with the service even
though creating such an account might not guarantee that the end-user will be
able to access the app using the service (e.g. because the end-user needs to
provide more registration info to the app). This is potentially confusing to
the end-user but the identity service developer can't prevent it.

* When using an external service, that service might provide it's own UI that
asks the end-user to give permission to the app even though giving such
permission might not guarantee that the end-user will be able to access the
app using the service (e.g. because the end-user needs to provide more
registration info). This is potentially confusing to the end-user but the
identity service developer can't always prevent it.

* When using an external service, that service might not support calling an
arbitrary Javascript callback when a authentication attempt finishes. For
example, this is the case when using an OAuth provider in a context (e.g.
Safari mobile?) where popups can't be used. Or consider an external service
that authenticates a user by sending a link to the user's phone in an SMS
message. The user might initiate the sign-in or sign-up from the browser on
his desktop machine but use the browser on his phone to follow the link and
finish the process. In cases like these, the external service typically
provides a way for the identity service developer to pass some limited "state"
into the external service when initiating the authentication process, and a
way to extract that "state" (e.g. from an URL) when the authentication attempt
succeeds.

The accounts UI package developer has the following concerns:

* He wants identity services to be pluggable so that he doesn't need to
special-case each service and the app developer can choose from a variety of
identity service

## Compatibility Stories

Existing apps continue to work the same as before.

Meteor 1.2 can be monkey patched to support new features.

MDG is willing to include (in the next minor release) any PRs that are required
to make the system work without monkey patching.

Existing login services which call `Accounts.registerLoginHandler` do
not need to be changed to be supported as identity services. This
includes core services like `accounts-password` and `accounts-google`, as well
as third party services, both OAuth and non-OAuth.

## Policy Stories

Merely having the `accounts` package installed does not allow a client to
perform any action that results in adding any documents to any server-side
collections, by default. Installing identity service packages (e.g.
`accounts-password`), calling a function in the API, or changing the default
configuration may result in this restriction being lifted.

The `onCreateUser` handler is called if and only if a new account is to be
created.

The `onValidateNewUser` handlers are called if and only if a new account is to
be created and no account is created if any of those handlers throws an error or
returns false.

The `onValidateLoginAttempt` handlers are called when a user performs an action
which could result in them being logged in to a new or different account. Should
they also be called when logging in to the account they are already logged in
to? To ensure backward compatibility, I think the answer is "yes". Should they
also be called when adding a service to an existing account? I'm leaning toward
"no" to be consistent with the current behavior when calling other methods that
modify the credentials required to access the current account (e.g.
`changePassword`). Instead, I'm thinking we should provide a new
`onValidateUpdateCredentials` hook (see below).

The (new) `onValidateUpdateCredentials` handlers are called if and only if a
service is to be added to the current user's account, or the credentials
associated with an existing service are to be changed (e.g. `changePassword`).

The `onLogin` handlers are called if and only if the `onValidateLoginAttempt`
handlers are called and the user is logged into an account.

The `onLoginFailure` handlers are called if and only if the
`onValidateLoginAttempt` handlers are called and the user is not logged into an
account.

The callbacks registered with the (new) server-side method
`addSignedUpInterceptor(callback)` (or something similar) are called to
determine whether a user has signed up. For details on the envisioned
functionality, see [the brettle:accounts-login-state
README](https://github.com/brettle/meteor-accounts-login-state/blob/master/README.md).

The callbacks registered with the (new) server-side method
`addHasDataInterceptor(callback)` (or something similar) are called to determine
whether a guest user has any associated data. If no callbacks are registered or
any registered callback returns true, then the user's state is Guest with Data.
Otherwise, the user's state is Guest without Data.

If and only if a callback is set with the (new) server-side method
`setMergeUsersHandler(callback)` (or something similar), then the Merge Account
Associated with Service X action is available and the callback will be called
with the two accounts to be merged when the user performs that action. It must
return the id of whichever of those two accounts the user should be logged in
to.

## Stories for Identity Services Developers Using External Services

### Minimize confusion caused by external services

An identity service developer can provide support for signing up and
signing in using an external service that asks the user to create on with
service and prompts the user to give the app permission, in a way that allows a
UI developer to minimize any end-user's confusion.

### Support external services that "split" authentication

An identity service developer can provide support for signing up and
signing in using an external service that does not pass control back to the
initiating client and instead only allows a limited "state" object that is
passed in an URL that the end-user visits (potentially with a different client)
upon successful authentication.

## User Interface Stories

The accounts system is UI framework agnostic and does not dictate how the
actions are made available to the user. For example, an app can put them in a
dropdown, in the body of a page, or split across multiple pages. UI code calls
into a client-side API that we provide to perform the actions.

The API provides a way for the UI to determine which identity services are
available.

The API provides a consistent way for UI code use the registered identity
services so that it doesn't need to special-case each service.