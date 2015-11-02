# API

## The options object

The new API provides a consistent interface across login service providers. This makes it easier to write general-purpose accounts UI packages. The key to the consistent interface is the options object.

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

The idea is to document and reserve some property names, and provide `services` so that services can use namespaced options as needed.

## Client-side

### `Accounts.login(service, options, callback)`

Tries to login a user. Throws an exception if
* account doesn't exists
* credentials are invalid

### `Accounts.createUser(service, options, callback)`

Tries to create an account that the user can login to using `service`, if such an account does not already exist. Then tries to login as the new or existing user. Throw an exception if
* credentials are invalid

### `Accounts.addService(service, options, callback)`

Tries to make it possible for the current user to login using 'service' in the future. Throws an exception if
* the user is not already logged in
* credentials are invalid

### `Accounts.setMethodOptions(options)`

Set the options that to pass to the server when making future login method calls. Server-side code can access these options by calling `Accounts.getMethodOptions()`. These options allow client-side code to communicate user intent (and other information that the new accounts API supports) when using legacy login handlers. The `options` object has the same form as the one passed to `Accounts.login(options)` and `Accounts.createUser(options)`. In particular, note that `options.treatAs` can be used to communicate the user's intent.

Example usage:

 ```js
Accounts.setMethodOptions({ treatAs: 'createUser', ... });
Meteor.loginWithGoogle(); // Will *not* login if the user already exists.
```

## Server-side

### `Accounts.getMethodOptions()`

Returns the last options object passed to `Accounts.setMethodOptions(options)` on the client.

### `Accounts.addAlias(idOfAliasUser)`

Makes the user with specified id into an alias user for the current user. That means that if a login handler returns an id of `idOfAliasUser`, the login will proceed as though it had returned the current user's id. Alias users can be used to allow a user to login using multiple login services and even multiple accounts on the same service. They can also be used to identify existing users which should be merged. This fails if there is no current user or if the requested alias user is already an alias user for some other user.

### `Accounts.removeAlias(idOfAliasUser)`

Fails if the user with the specified id is not an alias user for the currently logged in user or if there is no current user. Otherwise, makes the specified user no longer an alias user.

### `Accounts.validateUpdateCredentials(func)` 

`func` is called if and only if a service is to be added to the current user's account (e.g. via `Accounts.addAlias()`, or the credentials associated with an existing service are to be changed (e.g. `changePassword`). [Not sure if this is needed --@brettle]

### `Accounts.addSignedUpInterceptor(func)`

`func` is called to determine whether a user has signed up. For details on the envisioned functionality, see [the brettle:accounts-login-state README](https://github.com/brettle/meteor-accounts-login-state/blob/master/README.md).

### `Accounts.addHasDataInterceptor(func)` 

`func` is called to determine whether a guest user has any associated data. If no callbacks are registered or any registered callback returns true, then the user's state is Guest with Data. Otherwise, the user's state is Guest without Data.

### `Meteor.setUserid(id, [overrideLogin])`

This function throws an error if called while executing a login method, unless `overrideLogin` is `true`. Changing the current user from within a login method can create subtle security vulnerabilities. For example:

```
this.setUserId(idOfUserA);
Accounts.addAlias(idOfUserB);
```

This would let user B login to user A's account, even though current user has not given permission for this to occur. This is most often seen in attempts to merge users based on solely on email address. But when user A created his account, he specified what service he wanted to use for authentication. Allowing access by an attacker who manages to authenticate with a different service that provides the same email address is a betrayal of the user's trust.

Passing `true` for `overrideLogin` indicates that you understand the risks and still want to change to another user.

# Implementation Ideas

## Method Options

1. Before calling `Meteor.loginWith*`, `createUser`, or other login methods, the client specifies the user's intent by calling `Accounts.setMethodOptions({ treatAs: methodName, ... })`.
2. `Accounts.setMethodOptions()` stores the specified options somewhere that they will survive until `Accounts._callLoginMethod()` is called. Possibilities include localStorage or on the server.
3. We change the client's `Accounts._callLoginMethod()` to add the current method options as a method argument.
4. We change the server's `Accounts._loginMethod()` and the builtin `login` method to remove that argument and attach it to the `DDP._CurrentInvocation.get()` object before invoking the real method.
5. We add `Accounts.getMethodOptions()` to get the options from the `DDP._CurrentInvocation.get()` object.
6. We change `Accounts.insertUserDoc()` to or other server-side accounts code to retrieve the options using `Accounts.getMethodOptions()` and behave appropriately.

## Alias Accounts

After a login handler returns the user id of the matching user, we check to see whether that user has an `_aliasFor` property. If it does, we use that property's value as the real user id from then on. `Accounts.AddAlias(idOfAliasUser)` and `Accounts.removeAlias()` manage the `_aliasFor` property and perform safety checks to avoid developers accidentally introducing security vulnerabilities.
