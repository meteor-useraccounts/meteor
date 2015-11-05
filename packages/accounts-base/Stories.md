# Introduction

These are the stories that motivate the design of the accounts system. Although a particular app might not support all of these stories and some stories might be even be incompatible with each other, the accounts system itself should allow an app to support any combination of mutually compatible stories.

# End-User Stories

The end-user has the following characteristics:

* he might not remember whether he already has an account and/or which service(s) he has associated with the account
* he wants to be able to sign-up for an account if he doesn't have one
* he wants to be able to sign-in to any accounts he has
* he wants to avoid accidentally creating multiple accounts in the app
* he might want to intentionally create multiple accounts (e.g. a separate one for administration)
* he might prefer to use or not use a particular login service to sign-in/sign-up. For example, he might prefer to not establish a password with the app or he might prefer to not reveal his email address to the app.
* he might want to be able to sign-in to the same account using multiple login services. This can make signing-in more convenient, and provide a backup if he becomes unable to login using one login service (e.g. forgot password, or external account deleted). It can also make it easier for him to share information between the app and external services (e.g. sharing app data with others, or importing personal information from the external service into the app).

To avoid a lot of repetition, I'm structuring the stories in terms of the behavior various end-user actions should have in various end-user states. First I'll describe the states and the actions available from them, and then I'll describe the behavior of the actions themselves.

## End-user States

### Logged Out

The user is not logged in to any account. This state does not exist in apps that automatically log users in to guest accounts. In this state the app provides some subset of the following actions: 
* Sign In with Service X
* Sign Up with Service X
* Sign In/Up with Service X
* Sign In as Guest. 

### Guest

The user is logged in to an account that was created for him but he has not yet established a way to sign in to that account from another browser profile (i.e. he has not yet "signed up"). As a result, the app provides some subset of the following actions: 
* Sign In with Service X
* Sign Up with Service X
* Sign In/Up with Service X
* Delete Account
* Merge Account Associated with Service X. 

#### Guest without Data

A substate of Guest where the user has not associated any data with the account.

#### Guest with Data

A substate of Guest where the user has associated some data with the account.

### Signed Up

The user is logged in to an account that he is able to sign in to from another browser profile. As a result, and app provides some subset of the following actions:
* Add Service X
* Remove Service X
* Sign Out
* Delete Account
* Switch User with Service X
* Merge Account Associated with Service X. 

If there are multiple login services, the app probably won't provide Switch User with Service X, opting instead to have the user first choose Sign Out, and then Sign In/Up with Service X. If there is only one login service, the app won't provide Add Service X and Remove Service X but is more likely to offer a Switch User action. Also, the app will not offer the Add Service X action for services that are already associated with the account, nor will it offer the Delete Service X action for services that are not associated with the account. It will also not offer any Delete Service X actions if there is only one service associated with the account.

## Internal Actions

These actions aren't directly initiated by the user, but are used by other actions that the user can initiate and they typically involve user interaction.

### Create Login with Service X

This action can result in the user having a "login" associated with service X (i.e. he has successfully authenticated with service X), even though the user might not be able to use the login to sign-in to an account yet.

If the login service for service X is not capable of trying to create a login for service X, the outcome reported to the calling action is "not supported".

If the login service for service X is capable of trying to create a login for service X, the app gathers any credentials required (e.g. user's requested username/email/password) and initiates the login creation process. If the login is created successfully, the Register User with Service X action is run. If it fails due to a conflicting account, the user is asked whether he wants to sign-in to the conflicting account. If he does not, his state remains unchanged and the calling action is canceled. Otherwise the Login to Account action is run.

### Authenticate with Service X

This action can result in the user having a "login" associated with service X (i.e. he has successfully authenticated with service X), even though the user might not be able to use the login to sign-in to an account yet.

If the user already has a login associated with service X a successful outcome is reported.

Otherwise, the app passes the information that the user has already provided (e.g. password) to the login service for service X. The login service uses that information and/or requires the user to take additional action (e.g. login to an external service that support OAuth, or follow a link in an email or SMS) to authenticate the user. The login service might also allow the user to register with an external service before authenticating and/or require that the user give the app permission to access his account on the external service. 

The authentication process might:

* redirect the client to a new page, causing the app to reload. The reloaded app should allow the user to continue whatever action was in process.
* require the user to follow a link and the user might do that in a different client than the one where he initiated the sign-in process. After following the link, the user should be able to continue whatever action was in process from either the new client or the initiating client. Under some circumstances (e.g. user never follows a link), a login service might never report the outcome of the authentication. However, when the authentication outcome is reported, it can be reported to have either succeeded or failed.
* 
### Login to Account

This action isn't directly initiated by the user, but is initiated by other actions that the user can initiate and it may involve user interaction.

If the user is not a Guest with Data, he is logged in to the account and his state is changed to Signed Up.

If the user is a Guest with Data, he sees something like "What should we do with your guest account? [Delete It and Sign-In] [Keep It and Cancel Sign-In] [Merge It]". If he chooses "Delete it and Sign-In", his guest account is deleted, he is logged in to the other account, and the calling action continues. If he chooses "Merge It", the user's guest account and the other account are merged in an app-specific manner (potentially with user input), the user is logged in to the merged account, and as a result his state is Signed Up.

### Register User with Service X

The app attempts to gathers any necessary registration information from the service. If the app requires additional registration information, the user sees something like "Please provide the following additional information to  complete your registration...". If the user does not provide the required information, the sign-up is canceled and the user's state remains unchanged. If he does provide the required information, it is added to his guest account if he is a Guest, or a new account if he is not. In either case, he can sign-in to the account using service X in future, and his state is changed to Signed Up.

## End-User Actions

These are actions that are initiated by the end-user.

### Sign In with Service X

The app runs the Authenticate with Service X action. 

If the authentication fails, the user sees something like "Sign-in Failed" and his state remains unchanged. 

If the authentication succeeds and there is an existing app account which matches the authentication, the Login to Account action is run.

If the authentication succeeds but there is not an existing app account which matches the authentication, the user's state remains unchanged and the user sees something like "You don't yet have an account in this application associated your X login. Would you like to sign up using that login, or try a different login?". If the users chooses the "sign up" option, the Register User with Service X action is run.


### Sign Up with Service X

The app runs the Create Login with Service X action. If it is not supported, the app runs the Authenticate with Service X action and handles it's outcome as follows:

If the authentication fails, the user sees something like "Sign-in Failed", his state remains unchanged, and the sign-up is canceled.

If the authentication succeeds and there is an existing app account which matches the authentication, the Login to Account action is run.

If the authentication succeeds but there is not an existing app account which matches the authentication, the Register User with Service X action is run.

### Sign In/Up with Service X

An app should only offer this action when the user can only use one login service. 

The app runs the Authenticate with Service X action. 

If the authentication fails, the app runs the Create Login with Service X action. If it is not supported, then the user sees something like "Sign-in Failed" and his state remains unchanged. 

If the authentication succeeds and there is an existing app account which matches the authentication, then the Login to Account action is run.

If the authentication succeeds but there is not an existing app account which matches the authentication, the Register User with Service X action is run.

### Sign In as Guest

A new account is created and the user is logged into it. The user can only access it from his current browser profile. The user's state becomes Guest without Data.

### Delete Account

The user is logged out and his account is deleted. His new state becomes Logged Out.

### Sign Out

The user is logged out of his account (but his account remains). His new state becomes Logged Out.

### Switch User with Service X

This is equivalent to Sign In with Service X, but is only available when the user is in the Signed Up state.

### Merge Account Associated with Service X

The app gathers credentials for service X either automatically (e.g. with an OAuth service), or directly from the user. If the credentials don't match an existing account, the user's state remains unchanged and the user sees an "no such account" error message. If the credentials do match an existing account, the user's current account and the existing account are merged in an app-specific manner (potentially with user input), the user is logged in to the merged account, and as a result his state is Signed Up.

### Add Service X

This is equivalent to Sign Up with Service X, but is only available when the user is in the Signed Up state.

### Remove Service X

The user becomes unable to login to his current account using service X.

# Developer Stories

The application developer has the following concerns:

* Account creation policy: He might want to control which end-users can create accounts under which circumstances (e.g. only admins, only on connections from the intranet, or no one)
* Sign-in policy: He might want to control under what circumstances an end-user can sign-in to a particular account (e.g. only via an LDAP service when logging in from the intranet)
* He might want to control which end-users can insert records of any kind into the database (e.g. to prevent DoS attacks)

The login service provider developer has the following concerns:

* When supporting login via an external service, that service might provide it's own UI that asks the end-user whether he wants to create an account with the service even though creating such an account might not guarantee that the end-user will be able to access the app using the service (e.g. because the end-user needs to provide more registration info to the app). This is potentially confusing to the end-user but the login service provider developer can't prevent it.
* When supporting login via an external service, that service might provide it's own UI that asks the end-user to give permission to the app even though giving such permission might not guarantee that the end-user will be able to access the app using the service (e.g. because the end-user needs to provide more registration info). This is potentially confusing to the end-user but the login service provider developer can't always prevent it.
* When supporting login via an external service, that service might not support calling an arbitrary Javascript callback when a login attempt finishes. For example, this is the case when using an OAuth provider in a context (e.g. Safari mobile?) where popups can't be used. Or consider an external service that authenticates a user by sending a link to the user's phone in an SMS message. The user might initiate the sign-in or sign-up from the browser on his desktop machine but use the browser on his phone to follow the link and finish the process. In cases like these, the external service typically provides a way for the login service developer to pass some limited "state" into the external service when initiating the authentication process, and a way to extract that "state" (e.g. from an URL) when the login attempt succeeds.

The accounts UI package developer has the following concerns:

* He wants login services to be pluggable so that he doesn't need to special-case each service and the app developer can choose from a variety of login service

## Compatibility Stories

Existing apps continue to work the same as before.

Meteor 1.2 can be monkey patched to support new features.

MDG is willing to include (in the next minor release) any PRs that are required to make the system work without monkey patching.

Existing login service providers which call `Accounts.registerLoginHandler` do not need to be changed to support new features. This includes core providers like `accounts-password` and `accounts-google`, as well as third party providers, both OAuth and non-OAuth.

## Policy Stories

Merely having the `accounts` package installed does not allow a client to perform any action that results in adding any documents to any server-side collections, by default. Installing login service packages (e.g. `accounts-password`), calling a function in the API, or changing the default configuration may result in this restriction being lifted.

The `onCreateUser` handler is called if and only if a new account is to be created.

The `onValidateNewUser` handlers are called if and only if a new account is to be created and no account is created if any of those handlers throws an error or returns false.

The `onValidateLoginAttempt` handlers are called when a user performs an action which could result in them being logged in to a new or different account. Should they also be called when logging in to the account they are already logged in to? To ensure backward compatibility, I think the answer is "yes". Should they also be called when adding a service to an existing account? I'm leaning toward "no" to be consistent with the current behavior when calling other methods that modify the credentials required to access the current account (e.g. `changePassword`). Instead, I'm thinking we should provide a new `onValidateUpdateCredentials` hook (see below).

The (new) `onValidateUpdateCredentials` handlers are called if and only if a service is to be added to the current user's account, or the credentials associated with an existing service are to be changed (e.g. `changePassword`).

The `onLogin` handlers are called if and only if the `onValidateLoginAttempt` handlers are called and the login is successful.

The `onLoginFailure` handlers are called if and only if the `onValidateLoginAttempt` handlers are called and the login fails.

The callbacks registered with the (new) server-side method `addSignedUpInterceptor(callback)` (or something similar) are called to determine whether a user has signed up. For details on the envisioned functionality, see [the brettle:accounts-login-state README](https://github.com/brettle/meteor-accounts-login-state/blob/master/README.md).

The callbacks registered with the (new) server-side method `addHasDataInterceptor(callback)` (or something similar) are called to determine whether a guest user has any associated data. If no callbacks are registered or any registered callback returns true, then the user's state is Guest with Data. Otherwise, the user's state is Guest without Data.

If and only if a callback is set with the (new) server-side method `setMergeUsersHandler(callback)` (or something similar), then the Merge Account Associated with Service X action is available and the callback will be called with the two accounts to be merged when the user performs that action. It must return the id of whichever of those two accounts the user should be logged in to.

## External Login Service Stories

### Minimize confusion caused by external services

A login service provider developer can provide support for signing up and signing in using an external service that asks the user to create on with service and prompts the user to give the app permission, in a way that allows a UI developer to minimize any end-user's confusion.

### Support external services that "split" authentication

A login service provider developer can provide support for signing up and signing in using an external service that does not pass control back to the initiating client and instead only allows a limited "state" object that is passed in an URL that the end-user visits (potentially with a different client) upon successful authentication.

## User Interface Stories

The accounts system is UI framework agnostic and does not dictate how the actions are made available to the user. For example, an app can put them in a dropdown, in the body of a page, or split across multiple pages. UI code calls into a client-side API that we provide to perform the actions.

The API provides a way for the UI to determine which login services are available. 

The API provides a consistent way for UI code use the registered login services so that it doesn't need to special-case each service.





