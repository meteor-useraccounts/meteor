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
  },
  clientState: 'string to pass to onAttemptCompletion() handler'
}
```

The idea is to document and reserve some property names, and provide `services`
so that identity services can use namespaced options as needed.

## Client-side API for app developers


### `Identity.create(serviceName, options)`

Ask the specified service to create an identity. Returns `false`, if the service
does not support creating identities. Otherwise returns `true` and initiates an
attempt to create an identity.

When the attempt completes, the `options.clientState` is available as
`invocation.clientState` in the callbacks registered with
`Identity.onAttemptCompletion` on what could be a different client than the one
where `Identity.create` was called, depending on the identity service.

### `Identity.authenticate(serviceName, options)`

Ask the specified identity service to attempt to determine the user's identity.

When the attempt completes, the `options.clientState` is available as
`invocation.clientState` in the callbacks registered with
`Identity.onAttemptCompletion` on what could be a different client than the one
where `Identity.authenticate` was called, depending on the identity service.

### `Identity.onAttemptCompletion(callback)`

Registers `callback` to be called when an identity service completes an attempt
at identity creation or authentication. `callback` will receive the following
arguments:

* an error object (`undefined` if there was no error). The error argument will
contain an `Error` if the user cancels the attempt, fails in an authentication
attempt, or attempts to create an identity that would conflict with an identity
associated with an existing account.

* a result object, if the attempt was successful, containing the following 
  properties:

  * `methodName` - the name of the method that was called on the initiating
    client (either `create`, or `authenticate`). 

  * `clientState` - the `options.clientState` passed to the method that
    initiated the attempt. This can be used to migrate the user's state to the
    (potentially) different client.
    
  * `identity` - the identity that was created or authenticated.
    `identity.serviceName` contains the name of the service that issued the
    identity.
  
Depending on the identity service, an attempt might never complete. Moreover, if
it completes the outcome might be reported (by calling the callbacks registered
with `Identity.onAttemptCompletion`) on a different client than the client that
initiated the attempt.

### `Accounts.login(identity, [callback])`

Log a user into the account associated with the specified identity.
Throws an exception if:

* an account associated with the identity doesn't exists

### `Accounts.create(identity, options, [callback])`

Create an account that can be logged into with the specified identity. Throws an
exception if:

* an account associated with the identity already exists

### `Accounts.addIdentity(identity, [callback])`

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

### `Accounts.removeIdentity(identity, [callback])`

Deny login to the current user's account using the specified
identity.  Throws an exception if

* the user is not logged in to an account

* the identity can not be used to login to the user's account

## Client-side API for identity service developers

### `Identity.registerService(identityService)`

Register `identityService` as an identity service. 

`identityService.name` is the name of the identity service.

`identityService.authenticate` is a required function which takes the same
parameters as `Identity.authenticate` (including `service`) and initiates
authentication of the user's identity with the identity service.

`identityService.create` is an optional function which takes the same parameters
as `Identity.create` (including `service`) and initiates creation of
a new identity with the identity service.

### `Identity.fireAttemptCompletion(err, result)`

Pass the outcome of an identity creation or authentication attempt to the
`Identity.onAttemptCompletion` callbacks. If `result` is not `undefined`, it
must contain at least an `identity` property whose value is the identity that
was created or authenticated. If it does not contain `clientState`,
`identity.serviceName`, and/or `methodName` properties, those  will be
constructed using the values passed to the most recent call to
`Identity.authenticate` or `Identity.create`.

## Server-side API for identity service developers

### `Identity.registerService(identityService)`

Register `identityService` as an identity service. 

`identityService.name` is the name of the identity service.

`identityService.verify` is a function which takes an identity, verifies that it
represents the end user that it claims to, and returns an identifier
corresponding to that end user. The returned identifier is unique within the
service and never reassigned to a different end user. If the identity can not be
verified, this function should `throw new
Error('identity-verification-failed')`.

### `Identity.isClientStateValid(clientState)`

Returns `false` if any `func` registered with
`Identity.validateClientState(func)` returns a falsey value. Otherwise, returns
`true`. An identity service should use this function to check the validity of
client state before storing it on the server or passing it to another client
(e.g. in an email). See `Identity.validateClientState` for more info.

## Server-side API for policy enforcement

### `Identity.validateVerificationAttempt(func)`

Set policy controlling whether a verified identity can be used. Analogous to
`Accounts.validateLoginAttempt`, but for identities instead of accounts. If the
identity service's `verify` function returned an end user identifier, that will
it will be in `attemptInfo.subjectId` and the initial value of
`attemptInfo.allowed` will be `true`. If the identity service's `verify`
function throws an error, `attemptInfo.subjectId` will be `undefined`, the
initial value of `attemptInfo.allowed` will be `false` and the initial value of
`attemptInfo.error` will be the error. If `attemptInfo.allowed` is `false`,
`func` can not override it (but can log the failure, for example). Otherwise,
`func` can set `attemptInfo.allowed = false` if `attemptInfo.identity` should
not be used. All `func`s registered with `Identity.validateVerificationAttempt`
are called whenever an identity is verified.

### `Identity.verify(identity)`

Call the `verify` function for `identity.serviceName` and then the functions
registered with `Identity.validateVerificationAttempt`. If `identity` is
verified and the verification attempt is deemed valid, returns an identifier
corresponding to the end user represented by the identity. The returned
identifier is unique within the service and never reassigned to a different end
user. If `identity` can not be verified or the verification attempt is deemed
invalid, throws `new Error('invalid-identity')`.

### `Identity.validateClientState(func)`

Set policy controlling what values are considered valid by
`Identity.isClientStateValid(clientState)`. This allows a consistent policy to
be enforced across multiple identity services that need to store client state
and/or pass it to other clients. The policy can be used to prevent an attacker
from exploiting client state to use the app to store or transfer his own data.

When `Identity.isClientStateValid(clientState)` is called, `clientState` is
passed to all `func`s registered with `Identity.validateClientState(func)`. If
any `func` returns a falsey value, `Identity.isClientStateValid` will return
`false`. Otherwise it will return `true.`

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
Accounts.addIdentity(identityB);
```

This would let the user with identity B login to user A's account, even though
user A has not given permission for this to occur. This is most often seen in
attempts to merge users based solely on email address. But when user A created
his account, he specified what service he wanted to use for authentication.
Allowing access by an attacker who manages to authenticate with a different
service that provides the same email address is a betrayal of the user's trust.

Passing `true` for `overrideLogin` indicates that you understand the risks and
still want to change to another user.

# Basic Client-Side Usage Example

Sign-in with Service X:
```js
Identity.authenticate(serviceName, options);
```

Sign-up with Service X:
```js
var options = {
  clientState: "SigningUp"
  ...
}
if (!Identity.create(serviceName, options)) {
  Identity.authenticate(serviceName, options);
}
```

Add Service X:
```js
var options = {
  clientState: "AddingIdentity"
  ...
}
if (!Identity.create(serviceName, options)) {
  Identity.authenticate(serviceName, options);
}
```

Common top-level code:
```js
Identity.onAttemptCompletion((err, result) => {
  if (err) {
    throw err; // Or otherwise handle it.
  }
  if (result.clientState === 'SigningUp') {
    Accounts.create(result.identity, accountOptions);
    Accounts.login(result.identity);
  } else if (result.clientState === 'AddingIdentity') {
    if (Meteor.userId()) {
      // Require user confirmation to prevent an attacker from adding his
      // identity to a victim's account by getting a logged in victim to follow
      // a link which an identity service uses to authenticate the link-follower
      // as the attacker.
      if (window.confirm(
          `Allow ${result.identity} to sign-in to your account?`)) {
        Accounts.addIdentity(result.identity);        
      }
    } else {
      window.alert(
        `You must be signed in to add ${result.identity} to your account`);
    }
  } else {
    Accounts.login(result.identity);    
  }
});
```

# Implementation Ideas

### Server-side stuff

Identity services are responsible for managing any server-side resources
necessary to create/authenticate identities. Some identity services (e.g. one
considers a user's public key to be his identity), might not need to store any
identity information on the server. Others might maintain their own
collection(s) and issue identity tokens in the same way that the `resume`
service creates login tokens.

### Miscellaneous

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

That helps secure identity tokens on the client, but the tokens themselves need
to be passed from the server to the client. This should not be done within a
login error because such an error is passed to the server-side
`Accounts.onLoginFailure` callbacks. If there is a callback registered to log
those errors, the identity tokens would end up in the logs. Instead, attach the
identity tokens to the connection and have the client make a separate
server-method call to retrieve the tokens when it sees the error.

Attaching the identity tokens to the connection is insecure if an attacker can
take over a connection. Can he? Does he just need to disconnect the victim,
guess a DDP session number, and reconnect using that number? Or is the
connection object recreated on a reconnect?

# Other Ideas

## Should we make the identity object internal or optional?

We could have the identity implementation internally keep track of the
identities that the client has created/authenticated. `Accounts.login`,
`Accounts.create`, and `Accounts.addIdentity` could then either not take an
identity argument at all or it could be optional. If it is not provided the
implementation would use the most recently created/authenticated identity. This
would simplify the API syntax but it introduces new global state which might
cause headaches. In particular, I'm thinking of the case where the user is
trying to sign-up using identity A and, after the user has authenticated as A
but while the UI is gathering additional registration information to create an
account for the user, the client somehow authenticates as identity B. When the
UI calls `Accounts.create`, I'm not sure it makes sense to associate the created
account with identity B (the most recently authenticated identity).
