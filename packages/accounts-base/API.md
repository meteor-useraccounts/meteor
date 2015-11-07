# API

## The options object

The new API provides a consistent interface across identity services. This
makes it easier to write general-purpose accounts UI packages. The key to the
consistent interface is the options object.

Here is an example:

```
options = {
  treatAs: 'createUser', // Used when calling legacy providers, see Accounts.setMethodOptions()
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

### `Accounts.addIdentity(identity, options, [optionalCallback])`

Make it possible to login to the current user's account using the specified
identity.  Throws an exception if

* the user is not logged in to an account

## Server-side

### `Accounts.addAlias(idOfAliasAccount)`

Makes the account with specified id into an alias for the current user's
account. That means that logging into the alias account will actually result in
logging into the current user's account. Alias accounts can be used to allow a
user to login to one account using multiple identities on the same service. They
can also be used to identify existing accounts which should be merged. This
fails if the current user does not have an account or if the requested alias
account is already an alias for some other account.

### `Accounts.removeAlias(idOfAliasAccount)`

Fails if the account with the specified id is not an alias account for the
current user's account or if there is no current user. Otherwise, makes the
specified account no longer an alias.

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

# Implementation Ideas

## Alias Accounts

After a login handler returns the user id of the matching user, we check to see
whether that user has an `_aliasFor` property. If it does, we use that
property's value as the real user id from then on.
`Accounts.AddAlias(idOfAliasAccount)` and `Accounts.removeAlias()` manage the
`_aliasFor` property and perform safety checks to avoid developers accidentally
introducing security vulnerabilities.

## Identity IDs

Before authenticating the user, an identity service generates a secure GUID to
use as an "identity ID". It passes it to `Identity.addId(identityId)` on the
client and, if necessary, also passes it as part of the "state" that might end
up in a separate client if the authentication process ends in a different
browser than the one where it started. In the (potentially different) client,
the identity service completes the authentication process, stores the "identity
ID" in a new server-side object and passes the identity ID to
`Identity.addId(identityId)`. User can then use either client to register, by
gathering any additional registration information from the user,
asking/confirming which identities to link to the new account, and passing the
identity IDs into `Accounts.create` along with the other information required to
register. The server uses the identity IDs to finds the existing server-side
objects and link them to the new account. 

## Separate creating identities from creating accounts

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

Common top-level code:
```js
Identity.onAttemptCompletion((err, service, method, state, identity) => {
  if (state === 'SigningUp') {
    Accounts.create(identity);
  }
  Accounts.login(identity);
});
```
