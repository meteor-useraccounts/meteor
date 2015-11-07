# API

## The options object

The new API provides a consistent interface across identity services. This
makes it easier to write general-purpose accounts UI packages. The key to the
consistent interface is the options object.

Here is an example:

```
options = {
  username: 'elpresidente',
  email: 'george.washington@gmail.com',
  appData: appSpecificObjectWithOtherDataProvidedDuringRegistrationEtc
  otherReservedOrNonconflictingPropName: value,
  ...
  oauth: oauthSpecificOptions
  services: {
    google: googleSpecificOptions,
    password: passwordSpecificOptions,
   ...
  }
}
```

The idea is to document and reserve some property names, and provide `services`
so that identity services can use namespaced options as needed.

## Client-side


### `Identity.create(service, options, [optionalStateString])`

Ask the specified service to create an identity. Returns `false`, if the service
does not support creating identities. Otherwise returns `true` and initiates an
attempt to create an identity.

When the attempt completes, the `optionalStateString` is passed to the callbacks
registered with `Identity.onAttemptCompletion` on what could be a different client
than the one where `Identity.create` was called, depending on the
identity service.

### `Identity.authenticate(service, options, [optionalStateString])`

Ask the specified identity service to attempt to determine the user's identity.

When the attempt concludes, the `optionalStateString` is passed to the callbacks
registered with `Identity.onAttemptCompletion` on what could be a different client
than the one where `Identity.authenticate` was called, depending on the identity
service.

### `Identity.onAttemptCompletion(callback)`

Registers `callback` to be called when an identity service completes an attempt
at identity creation or authentication. `callback` will receive the following
arguments:

* an error object (`undefined` if there was no error). The error argument will
contain an `Error` if the user cancels the attempt, fails in an authentication
attempt, or attempts to create an identity that would conflict with an identity
associated with an existing account.

* the service that is reporting the outcome

* the name of the method that was called on the initiating client (either
`createIdentity`, or `authenticate`). 

* the `optionalStateString` passed to the method that initiated the attempt. The
`optionalStateString` can be used to migrate the user's state to the
(potentially) different client.

* the new identity, if the attempt was successful

Depending on the identity service, an attempt might never complete. Moreover, if
it completes the outcome might be reported (by calling the callbacks registered
with `Identity.onAttemptCompletion`) on a different client than the client that
initiated the attempt.

### `Accounts.login(identity, [optionalCallback])`

Log a user into the account associated with the specified identity.
Throws an exception if:

* an account associated with the identity doesn't exists

### `Accounts.createAccount(identity, options, [optionalCallback])`

Create an account associated with the specified identity. Throws an exception
if:

* an account associated with the identity already exists

### `Accounts.addIdentity(identity, [optionalCallback])`

Allow login to the current user's account using the specified
identity.  Throws an exception if

* the user is not logged in to an account

### `Accounts.getIdentities()`

Returns the identities that can be used to login to the current user's
account. Throws an exception if

* the user is not logged in to an account

Note: The returned identities are intended to be used to support showing the
user which identities can login to his account and to allow the user to remove
an identity from his account. For security reasons, the identities can't be
passed to `Accounts.login` or `Accounts.addIdentity` because the current client
hasn't authenticate as them. As an example of the security concern, consider an
app that restricts certain access to users who have logged in to an account
using an identity from the VerySecure service. The victim's account can be
logged into using either a VerySecure identity or a LessSecure identity. The
victim is on a client that he knows is at risk, so he logs in using his
LessSecure identity. The attacker gains access to the victim's logged in client
and calls `Accounts.getIdentities`. If the VerySecure identity that is returned
can be passed to `Accounts.login` then the attacker can gain the associated
privileged access. The attacker _can_ remove the VerySecure identity from the
account, thereby denying the victim privileged access. However, the victim can
presumably re-authenticate and re-add the VerySecure identity, or have an
administrator do so. Also, we must allow a user to remove an identity that he
can't authenticate as so that he has a way to remove an identity added by an
attacker or one over which he has lost control.

### `Accounts.removeIdentity(identity, [optionalCallback])`

Deny login to the current user's account using the specified
identity.  Throws an exception if

* the user is not logged in to an account

* the identity can not be used to login to the user's account

## Server-side

### `Accounts.addSignedUpInterceptor(func)`

`func` is called to determine whether a user has a registered account. For
details on the envisioned functionality, see [the brettle:accounts-login-state
README](https://github.com/brettle/meteor-accounts-login-state/blob/master/README.md).

### `Accounts.addHasDataInterceptor(func)` 

`func` is called to determine whether a guest user has any associated data. If
no callbacks are registered or any registered callback returns true, then the
user's state is Guest with Data. Otherwise, the user's state is Guest without
Data.

### `Meteor.setUserid(id, [overrideLogin])`

This function throws an error if called while executing a login method, unless
`overrideLogin` is `true`. Changing the current user from within a login method
can create subtle security vulnerabilities. For example:

```
this.setUserId(idOfAccountA);
Accounts.addAlias(idOfAccountB);
```

This would let user B login to user A's account, even though the current user
has not given permission for this to occur. This is most often seen in attempts
to merge users based solely on email address. But when user A created his
account, he specified what service he wanted to use for authentication. Allowing
access by an attacker who manages to authenticate with a different service that
provides the same email address is a betrayal of the user's trust.

Passing `true` for `overrideLogin` indicates that you understand the risks and
still want to change to another user.

# Basic Client-Side Usage Example

Sign-in with Service X:
```js
Identity.authenticate(serviceName, options);
```

Sign-up with Service X:
```js
var state = "SigningUp";
if (!Identity.create(serviceName, options, state)) {
  Identity.authenticate(serviceName, options, state);
}
```

Add Service X:
```js
var state = "AddingIdentity";
if (!Identity.create(serviceName, options, state)) {
  Identity.authenticate(serviceName, options, state);
}
```

Common top-level code:
```js
Identity.onAttemptCompletion((err, service, method, state, identity) => {
  if (state === 'SigningUp') {
    Accounts.create(identity);
    Accounts.login(identity);
  } else if (state === 'AddingIdentity') {
    if (Meteor.userId()) {
      // Require user confirmation to prevent an attacker from adding his
      // identity to a victim's account by getting a logged in victim to follow
      // a link which an identity service uses to authenticate the link-follower
      // as the attacker.
      if (window.confirm(`Allow ${identity} to sign-in to your account?`)) {
        Accounts.addIdentity(identity);        
      }
    } else {
      window.alert(`You must be signed in to add ${identity} to your account`);
    }
  } else {
    Accounts.login(identity);    
  }
});
```

# Implementation Ideas

## General

Have `Identity.create('password', options, state)` wrap
`Accounts.createUser(options, callback)` such that:

* the options passed to `Accounts.createUser` indicate that the call was
initiated by `Identity.create`

* the callback passes the `state` to the `Identity.onAttemptCompletion`
callbacks.

Have `Identity.authenticate(serviceOtherThanPassword, options, state)` wrap
`Meteor.loginWith<service>(options, callback)` such that:

* the options passed to `Meteor.loginWith<service>` indicate that the call was
initiated by `Identity.authenticate` and `options.redirectUri` passes `state` to
an endpoint that can pass it on to `Identity.onAttemptCompletion` 
callbacks.

* the callback passes the `state` to the `Identity.onAttemptCompletion` 
callbacks.

Have `Identity.authenticate('password', options, state)` wrap
`Meteor.loginWithPassword(user, password, callback)` such that:

* the callback function object has a property indicating that the call was
initiated by `Identity.authenticate`.

* the callback passes the `state` to the `Identity.onAttemptCompletion` 
callbacks.

Change `Accounts._callLoginMethod()` to detect the callback function property
set by `Identity.authenticate('password', options, state), and change the
options passed to the server to indicate that the call was initiated by
`Identity.authenticate`.

Create a new `Identity.identities` collection. Each document in the collection
will look like:

```js
{
  serviceName: 'google',
  serviceCredentials: { ... }, // same as `services.google` in user document
  identityCredentials: { ... }, // similar to `services.resume` in user doc
  accountId: 'WEavsd123' // undefined or ID of account the identity can login to
}
```

The `identityCredentials` are used to create identity tokens in the same way
that the `resume` service creates login tokens. If a user's client has a valid
identity token then the user has been authenticated as the corresponding
identity.

Add a `Meteor.validateLoginAttempt` handler that checks whether the login
attempt originated from `Identity.authenticate` and `Identity.create` and, if it
does, upserts a document into the  `Identity.identities` collection corresponding
to the service property used to login, and throws a
`Meteor.Error('identity-upserted', identityToken)` error. 

Add a `Meteor.validateNewUser` handler that checks whether the user document has
a `services` property and, if it does, upserts a document into the
`Identity.identities` collection corresponding to the first (and typically only)
service, and throws a `Meteor.Error('identity-upserted', identityToken)`
error. 

Change `Accounts._callLoginMethod()` to detect the returned `identity-upserted`
errors and pass the identity token to the `Identity.onAttemptCompletion`
callbacks.

Have `Accounts.create` call a new server method that uses the identity token to
find the identity document and updates it's `accountId` to refer to the new
account.

Have `Accounts.login` call a new server login method that uses the identity
token to find the identity document and log the user into the account referred
to by it's `accountId`.

Have `Accounts.addIdentity` call a new server method uses the identity token to
find the identity document and updates it's `accountId` to refer to the current
user's account.

Have `Accounts.create`, `Accounts.login`, and `Accounts.addIdentity` also copy
the service data they use into the 'services' property of the account so that
`Meteor.loginWith*` methods continue to work when called directly.

Change `Meteor.logout` and `Meteor.logoutOtherClients` to destroy all identity
tokens in identities that refer to the current user's account. This ensures that
the user will need to reauthenticate an identities in order to use it to login.
Handling of login tokens remains unchanged, so that calling `Meteor.logout` on
one client will not force the user to reauthenticate on another client where he
has already logged in.

## Security considerations

### Identity service must not authenticate based only on link-following

Consider an identity service which authenticates the user's identity by sending
a one-time link to him via email or SMS. The identity service assumes that the
first user to follow the link has the desired identity. However, before
authenticating the user it is critical that the service verify that the user
actually _wants_ to be authenticated as the identity. Failure to do so can
result in a victim being unknowingly logged into an attacker's account, or the
attacker's identity being added to the victim's account.

The latter can be prevented by having the initiating client associate a secret
with the user's account, pass the secret as part of the state, and then, on the
completing client, confirm that the secret in the state matches the secret in
the user's account before calling `Accounts.addIdentity()`. This could actually
be done automatically within `Identity.create` and `Identity.authenticate` and
whatever calls the `Identity.onAttemptCompletion` callbacks.

### Identity tokens must be secured

Identity tokens are as sensitive as login tokens. Login tokens are stored in
local storage, but since identity tokens are only needed briefly that is not
necessary. However, since the new API exposes identity objects that can be used
to login while the old API did not expose login tokens, we need to ensure that
the developer does not accidentally share an identity tokens by trying to share
an identity object. To achieve this we can store the identity tokens itself in a
function closure attached to the identity object. Like this:

```js
createIdentityForToken(token) {
  return {
    getToken(): function () { return token; },
    ...
  };
}
```

# Other Ideas
