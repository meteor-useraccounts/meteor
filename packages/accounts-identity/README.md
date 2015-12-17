# accounts-identity

A login service for creating and logging into accounts using identities created
by the `identity` package, and controlling which identities can access an
account.

## Status

This is a work in progress. It is not yet suitable for use on production
systems.

## Client-side API for app developers

### `Accounts.identity.login(identity)`

Log a user into the account associated with the specified identity. Returns a
`Promise` which is fullfilled upon success and rejected with an error upon
failure. If an account associated with the identity doesn't exists, the error
will be a `Meteor.Error(Accounts.identity.ACCOUNT_NOT_FOUND)`.

### `Accounts.identity.create(identity, accountDoc)`

Create an account that can be logged into with the specified identity and logs
the user into that account. Returns a `Promise` that is fulfilled upon success
and rejected with an error upon failure. If an account associated with the
identity already exists, the error will be a
`Meteor.Error(Accounts.identity.DUPLICATE_ACCOUNT)`.

### `Accounts.identity.addIdentity(identity)`

Allow login to the current user's account using the specified identity. Returns
a `Promise` that is fulfilled upon success and rejected with an error
upon failure. If the user is not logged in to an account, the error will be a
`Meteor.Error(Accounts.identity.NOT_LOGGED_IN)`.

### `Accounts.identity.getIdentities()`

Returns an array of identities that can be used to login to the current user's
account. If the user is not logged in to an account, throws
`Meteor.Error(Accounts.identity.NOT_LOGGED_IN)`.

Note: The returned identities are intended to be used to support showing the
user which identities can login to his account and to allow the user to remove
an identity from his account. For security reasons, the identities can't be
passed to `Accounts.identity.login` or `Accounts.identity.addIdentity` because
the current client hasn't authenticate as them. As an example of the security
concern, consider an app that restricts certain access to users who have logged
in to an account using an identity from the VerySecure service. The victim's
account can be logged into using either a VerySecure identity or a LessSecure
identity. The victim is on a client that he knows is at risk, so he logs in
using his LessSecure identity. The attacker gains access to the victim's logged
in client and calls `Accounts.identity.getIdentities`. If the VerySecure
identity that is returned can be passed to `Accounts.identity.login` then the
attacker can gain the associated privileged access. The attacker _can_ remove
the VerySecure identity from the account, thereby denying the victim privileged
access. However, the victim can presumably re-authenticate and re-add the
VerySecure identity, or have an administrator do so. Also, we must allow a user
to remove an identity that he can't authenticate as so that he has a way to
remove an identity added by an attacker or one over which he has lost control.

### `Accounts.identity.removeIdentity(identity)`

Deny login to the current user's account using the specified identity. Returns a
`Promise` that is fulfilled upon success and rejected with an error upon
failure. If the user is not logged in to an account, the error will be a
`Meteor.Error(Accounts.identity.NOT_LOGGED_IN)`. If `identity` can not be used
to login to the user's account, the error will be
`Meteor.Error(Accounts.identity.IDENTITY_NOT_FOUND)`.

## Basic Client-Side Usage Example

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
Identity.onAttemptCompletion(async function (err, result) {
  if (err) {
    throw err; // Or otherwise handle it.
  }
  let routeName = Router.current.getName();
  if (routeName === 'SignUp') {
    await Accounts.identity.create(result.identity, accountOptions);
  } else if (routeName === 'AddIdentity') {
    if (Meteor.userId()) {
      // Require user confirmation to prevent an attacker from adding his
      // identity to a victim's account by getting a logged in victim to follow
      // a link which an identity service uses to authenticate the link-follower
      // as the attacker.
      if (window.confirm(
          `Allow ${result.identity} to sign-in to your account?`)) {
        await Accounts.identity.addIdentity(result.identity);        
      }
    } else {
      window.alert(
        `You must be signed in to add ${result.identity} to your account`);
    }
  } else {
    await Accounts.identity.login(result.identity);    
  }
});
```

## Security considerations

Identities can be used to gain access to accounts. They are as powerful as login
tokens. As a result, `Meteor.logout` and `Meteor.logoutOtherClients`, should
cause existing identities to no longer work. To accomplish this, each account
has a `services.identity.notSignedBefore` property and does not permit login
using an identity with a `when` property that is earlier.  `Meteor.logout` and
`Meteor.logoutOtherClients` should set `services.identity.notSignedBefore` to
the then current time to ensure that only newly signed identites can be used to
login to the account. This can also be used to invalidate identities that have
been distributed or stored insecurely (e.g. sent in an email), if they need to
be invalidated before the secret used to sign them expires.

In a multi-server environment clock skew could cause an identity issued later by
another server to actually have a timestamp that is earlier. In normal use this
should not cause problems since there is no reason for a user to logout of an
account and then try to get another identity and use it to login to that same
account within a typical inter-server clock skew.

## TODO


### `Meteor.setUserid(id, [overrideLogin])`

This function throws an error if called while executing a login method, unless
`overrideLogin` is `true`. Changing the current user from within a login method
can create subtle security vulnerabilities. For example:

```
this.setUserId(idOfAccountA);
Accounts.identity.addIdentity(identityB);
```

This would let the user with identity B login to user A's account, even though
user A has not given permission for this to occur. This is most often seen in
attempts to merge users based solely on email address. But when user A created
his account, he specified what service he wanted to use for authentication.
Allowing access by an attacker who manages to authenticate with a different
service that provides the same email address is a betrayal of the user's trust.

Passing `true` for `overrideLogin` indicates that you understand the risks and
still want to change to another user.
