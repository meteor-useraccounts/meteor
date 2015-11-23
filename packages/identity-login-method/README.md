# identity-login-method

Support for creating identity services which establish identities with
`Meteor.loginWith<service>`. This is designed to ease the transition from
Meteor's old accounts system to the identity-based accounts system.

## Status

This is a work in progress. It is not yet suitable for use on production
systems.

## Documentation

### `Identity.loginMethod.establishWith(func, arg1, arg2, ..., [callback])`

Call `func` but cause it to establish an identity (create or authenticate)
whenever it would have created or logged a user into an account. The `arg*``
arguments are passed to `func`, along with a final argument that is a function
that must be called (with parameters `error` and `result`) if the login method
initiated by `func` completes in the same javascript virtual machine. That
function will call `Identity.fireAttemptCompletion` and then call the `callback`
function (with the same parameters) if one is provided. If the page is reloaded
due to an oauth redirect flow, `Identity.fireAttemptCompletion` will be called
at the end of that flow. Between the time that `func` is called and the time
that `Identity.fireAttemptCompletion` is called, all calls to server-side login
methods on the default connection that would normally cause the creation of an
account (i.e. cause the `Accounts.validateNewUser` callbacks to run) or a login
attempt (i.e. `Accounts.validateLoginAttempt` callbacks to run), will neither
log the user in nor create an account that can be logged into, and will instead
establish an identity.

### Password identity service

```js
Identity.registerService({
  name: 'password',
  create: (service, options) => {
    options = _.pick(options, 'user', 'username', 'email', 'password');
    Identity.loginMethod.establishWith(Accounts.createUser, options);
  },
  authenticate: (service, options) => {
    var user = options.user || options.username || options.email;
    Identity.loginMethod.establishWith(Meteor.loginWithPassword, 
      user, password);
  }
});
```

### OAuth-based identity services

```js
Identity.registerService({
  name: 'google',
  authenticate: (service, options) => {
    Identity.loginMethod.establishWith(Meteor.loginWithGoogle, options);
  }
});
```
