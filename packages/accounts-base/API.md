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


### `Identity.create(serviceName, options, [stateString])`

Ask the specified service to create an identity. Returns `false`, if the service
does not support creating identities. Otherwise returns `true` and initiates an
attempt to create an identity.

When the attempt completes, the `stateString` is available as `this.state` in
the callbacks registered with `Identity.onAttemptCompletion` on what could be a
different client than the one where `Identity.create` was called, depending on
the identity service.

### `Identity.authenticate(serviceName, options, [stateString])`

Ask the specified identity service to attempt to determine the user's identity.

When the attempt completes, the `stateString` is available as `this.state` in
the callbacks registered with `Identity.onAttemptCompletion` on what could be a
different client than the one where `Identity.authenticate` was called,
depending on the identity service.

### `Identity.onAttemptCompletion(callback)`

Registers `callback` to be called when an identity service completes an attempt
at identity creation or authentication. `callback` will receive the following
arguments:

* an error object (`undefined` if there was no error). The error argument will
contain an `Error` if the user cancels the attempt, fails in an authentication
attempt, or attempts to create an identity that would conflict with an identity
associated with an existing account.

* the new identity, if the attempt was successful

Within the callback `this` will have the following properties

* `state` - the `stateString` passed to the method that initiated the
attempt. The `stateString` can be used to migrate the user's state to
the (potentially) different client.

* `serviceName` - the name of the service that is reporting the outcome

* `methodName` - the name of the method that was called on the initiating client
(either `create`, or `authenticate`). 

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

### `Identity.establishWithLoginMethod(func, arg1, arg2, ..., [callback])`

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
attempt (i.e. `Accounts.validateLoginAttempt` callbacks to run), will not create
an account or log the user in and will instead establish an identity.

### `Identity.fireAttemptCompletion(err, identity, [invocation])`

Pass the user's most recent identity to the `Identity.onAttemptCompletion`
callbacks. If `invocation` is provided, it must be an object with `state`,
`serviceName`, and `methodName` properties. If `invocation` is not provided, one
will be constructed using the values passed to the most recent call to
`Identity.authenticate` or `Identity.create`. Within the callbacks `this` will
refer to the passed or created `invocation` object.

## Server-side API

### `Identity.validateNewIdentity(func)`

Set policy controlling whether new identities are added to the database.
Analogous to `Accounts.validateNewUser`, but for identities instead of accounts.

### `Identity.validateAuthenticationAttempt(func)`

Set policy controlling whether an identity is returned to the client. Analogous
to `Accounts.validateLoginAttempt`, but for authenticating as an identity
instead of logging in to an account.

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

On client:

```js
// Create a reactive dict to keep track of the context for the most recent call
// to Identity.create or Identity.authenticate
var ctx = new ReactiveDict('identity_ctx');
var services = {};
Identity.registerService = function (service) {
  services[service.serviceName] = service;
}

Identity.create = function (serviceName, options, state) {
  var service = services[serviceName];
  if (! service) {
    throw new Error(`No service named ${serviceName}`);
  }
  if (! service.create) {
    return false;
  }
  var invocation = {
    serviceName: serviceName,
    methodName: 'create',
    state: state
  };
  ctx.set('invocation', invocation);
  service.create.call(invocation, options);
}

Identity.authenticate = function (serviceName, options, state) {
  var service = services[serviceName];
  if (! service) {
    throw new Error(`No service named ${serviceName}`);
  }
  var invocation = {
    serviceName: serviceName,
    methodName: 'authenticate',
    state: state
  };
  ctx.set('invocation', invocation);
  service.authenticate.call(invocation, options);
}


ctx.setDefault('isEstablishing', false);

// Whenever the "establishing" state changes on the client, have the server 
// change the state associated with the connection as well.
Tracker.autorun(() => { 
  Meteor.call('Identity._setEstablishing', [ctx.get('isEstablishing')],
    handleError);
});

Identity.establishWithLoginMethod = 
  function (func /*, arg1, ..., [cb]*/) {
    var args = _.rest(arguments);
    var callback;    

    // Enable "establishng"
    ctx.set('isEstablishing', true);

    // Create/modify the callback to disable "establishing" and run
    // onAttemptCompletion handlers
    if (_.isFunction(_.last(args)) {
      callback = args.pop();
    }
    callback = _.wrap(callback, function (origCallback, err /*, err, result*/) {
      Identity._completeEstablishing(err, origCallback);
    });
    args.push(callback);

    // Call the login method
    return func.apply(Meteor, args);
};

// The redirect flow of services which use accounts-oauth will pass the 
// result of the login method to onPageLoadLogin callbacks.
Accounts.onPageLoadLogin((attemptInfo) => {
  var ai = attemptInfo;
  if (ai && ai.error && ai.error.error === 'Identity.identity-established' &&
      ctx.get('isEstablishing')) {
    Identity._completeEstablishing(err);
  }
});

Identity._completeEstablishing = function (err, callback) {
  ctx.set('isEstablishing', false);
  if (err.error === 'Identity.identity-established') {
    Meteor.call('Identity.getIdentity', [], (err, identity) => {
      Identity.fireAttemptCompletion(err, identity);
      callback.call(ctx.get('invocation'), err, identity);
    });
  } else {
    Identity.fireAttemptCompletion(err);
    callback.call(ctx.get('invocation'), err);
  }
};

Identity.fireAttemptCompletion = (err, identity, invocation) => {
  invocation = invocation || ctx.get('invocation');
  _.forEach(callbacks, (cb) => {
    cb.call(invocation, err, identity);
  });
}
```

On server: 
```js
Meteor.methods({
  'Identity._setEstablishing': (flag) => {
    // Set a flag on the current connection that we can check from our
    // `Accounts.validateNewUser` and `Accounts.validateLoginAttempt` callbacks.
    // When it is set, those callbacks will upsert the user's identity,
    // associate it with the current connection and return
    // Meteor.Error('Identity.identity-established')
  },
  'Identity.getIdentity': () => {
    // Return the identity set on the current connection by our
    // `Accounts.validateNewUser` and `Accounts.validateLoginAttempt` callbacks.
  }
})
```

### Password identity service

```js
Identity.registerService({
  name: 'password',
  create: (service, options, state) => {
    options = _.pick(options, 'user', 'username', 'email', 'password');
    Identity.establishWithLoginMethod(Accounts.createUser, options);
  },
  authenticate: (service, options, state) => {
    var user = options.user || options.username || options.email;
    Identity.establishWithLoginMethod(Meteor.loginWithPassword, user, password);
  }
});
```

### OAuth-based identity services

```js
var service = 'google';
Identity.registerService({
  name: service,
  authenticate: (service, options, state) => {
    Identity.establishWithLoginMethod(Meteor.loginWithGoogle, options);
  }
});
```

### Server-side stuff

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

Add a `Meteor.validateLoginAttempt` handler that checks whether the connection's
'create identity' flag is set and, if it is, upserts a document into the
`Identity.identities` collection corresponding to the service property used to
login, associates the identity with the current connection, and throws a `Meteor.Error('identity-established')` error. 

Add a `Meteor.validateNewUser` handler that checks whether the connection's
'create identity' flag is set and the user document has a `services` property
and, if it so, upserts a document into the `Identity.identities` collection
corresponding to the first (and typically only) service, associates the identity
with the current connection, and throws a `Meteor.Error('identity-established')`
error. 

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
