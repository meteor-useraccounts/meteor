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

## Client-side API for app developers


### `Identity.create(serviceName, options, [callback])`

Ask the specified service to create an identity. Returns `false`, if the service
does not support creating identities. Otherwise returns `true` and initiates an
attempt to create an identity.

When the attempt completes, the callbacks registered with
`Identity.onAttemptCompletion` are called on what could be a different client
than the one where `Identity.create` was called, depending on the identity
service. As a result, callers should use the current URL to store any client
state that will be needed after the attempt completes. This is typically done
using parameters for the current route.

If `callback` is provided and the attempt completes in the same Javascript
execution context, then `callback` will be called with the same arguments that
are passed to the `onAttemptCompletion` callbacks.

### `Identity.authenticate(serviceName, options, [callback])`

Ask the specified identity service to attempt to determine the user's identity.

When the attempt completes, the callbacks registered with
`Identity.onAttemptCompletion` are called on what could be a different client
than the one where `Identity.authenticate` was called, depending on the identity
service. As a result, callers should use the current URL to store any client
state that will be needed after the attempt completes. This is typically done
using parameters for the current route.

If `callback` is provided and the attempt completes in the same Javascript
execution context, then `callback` will be called with the same arguments that
are passed to the `onAttemptCompletion` callbacks.

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
    
  * `identity` - the identity that was created or authenticated.
  
An identity contains at least the following properties:

* `serviceName` - the name of the service that issued the identity.
  
* `id` - an identifier corresponding to the end user. The identifier is
  unique within the service and never reassigned to a different end user.
  
* `when` - when the identity was issued, in seconds since the epoch.
    
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
was created or authenticated. If it does not contain  `identity.serviceName`
and/or `methodName` properties, those  will be constructed using the values
passed to the most recent call to `Identity.authenticate` or `Identity.create`.

## Server-side API for identity service developers

### `Identity.sign(identity)`

Modify `identity` such that `Identity.verify` can detect tampering.

## Server-side API for policy enforcement

### `Identity.verify(identity)`

Verifies that `identity` represents the end user that it claims to. At a
minimum, it verifies that `identity.serviceName`, `identity.id`, and
`identity.when` have not been tampered with since `identity` was passed to
`Identity.sign`. If the identity can not be verified, throws `new
Meteor.Error('identity-verification-failed')`.

### `Identity.maxSecretAgeMs`

Identities not signed within the last `maxSecretAgeMs` milliseconds will be
rejected. This defaults to 2 days.

### `Identity.additionalSecret`

Identities are signed using a secret that changes at least every
`maxSecretAgeMs`. The secrets are stored in the database. If `additionalSecret`
is set, it will be combined with the secrets in the database, so that an
attacker would need to know both `additionalSecret` and a recent secret in the
database in order to sign identities. An identity signed while
`additionalSecret` has a particular value will only verify when
`additionalSecret` has the same value.

The default value is the value of `Meteor.settings.identity.additionalSecret`.

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
  ...
}
Router.go('SignUp');
if (!Identity.create(serviceName, options)) {
  Identity.authenticate(serviceName, options);
}
```

Add Service X:
```js
var options = {
  ...
}
Router.go('AddIdentity');
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
  let routeName = Router.current.getName();
  if (routeName === 'SignUp') {
    Accounts.create(result.identity, accountOptions);
    Accounts.login(result.identity);
  } else if (routeName === 'AddIdentity') {
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

### Identity revocation isn't needed

Identities can only be used to gain access to accounts. Each account should have
an `services.identity.issuedAfter` property and not permit login using an
identity with a `when` property that is earlier. Once a user is logged in to an
account (i.e. has a login token), he no longer needs the identity he passed to
`Accounts.login`, `Accounts.create`, or `Accounts.addIdentity`. Those methods,
as well as `Meteor.logout` and `Meteor.logoutOtherClients`, should set
`services.identity.issuedAfter` to `new Date()` to ensure that only newly issued
identites can be used to login to the account.

To avoid having to maintain a DB record for each identity issued, they can be
signed with a server secret. To limit damage caused by a compromised secret,
generate a new secret daily and accept identities signed with either of the two
most recent secrets. If a compromise is actually suspected, all secrets can be
replaced and the only cost is that logged out users need to reestablish their
identities.

### Unused identity tokens must be secured

Identity tokens that have not yet been used are as sensitive as login tokens.
Login tokens are stored in local storage, but since identity tokens are only
needed briefly that is not necessary. However, since the new API exposes
identity objects that can be used to login while the old API did not expose
login tokens, we need to ensure that the developer does not accidentally share
an identity token by trying to share an identity object. To achieve this we can
store the identity token itself in a function closure attached to the identity
object. Like this:

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
