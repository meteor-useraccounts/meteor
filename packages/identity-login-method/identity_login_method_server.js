/* globals IdentityLoginMethodCommonImpl, Meteor, Accounts, DDP, Identity */

class IdentityLoginMethodServerImpl extends IdentityLoginMethodCommonImpl {
  constructor() {
    super();

    Meteor.methods({
      // Set a flag on the current connection that we can check from our
      // `Accounts.validateNewUser` and `Accounts.validateLoginAttempt`
      // callbacks. When it is set, those callbacks will upsert the user's
      // identity, associate it with the current connection and return
      // Meteor.Error(Identity.loginMethod.IDENTITY_ESTABLISHED)
      'Identity.loginMethod._setEstablishing': function _setEstablishing(flag) {
        this.connection._identityIsEstablishing = flag;
      },
      // Return the identity set on the current connection by our
      // `Accounts.validateNewUser` and `Accounts.validateLoginAttempt`
      // callbacks.
      'Identity.loginMethod._getIdentity': function _getIdentity() {
        return this.connection._identity;
      },
    });

    let thisIdentityLoginMethodImpl = this;
    this._validateNewUserStopper = Accounts.validateNewUser((user) => {
      let invoc =
        DDP && DDP._CurrentInvocation && DDP._CurrentInvocation.get();
      let connection =
        invoc && invoc.connection;
      if (!(connection && connection._identityIsEstablishing)) {
        return true;
      }

      // Reserved for future use. For now, the mere existence of this property
      // prevents a user from logging in to the account.
      user._identity = {
      };
      let userId;
      try {
        userId = Accounts.users.insert(user);
      } catch (e) {
        // XXX string parsing sucks, maybe
        // https://jira.mongodb.org/browse/SERVER-3069 will get fixed one day
        if (e.name !== 'MongoError') throw e;
        if (e.code !== 11000) throw e;
        if (e.err.indexOf('emails.address') !== -1) {
          throw new Meteor.Error(403, 'Email already exists.');
        }
        if (e.err.indexOf('username') !== -1) {
          throw new Meteor.Error(403, 'Username already exists.');
        }
        // XXX better error reporting for services.facebook.id duplicate, etc
        throw e;
      }
      thisIdentityLoginMethodImpl._establishAndThrow(connection, userId);
    });

    this._validateLoginAttemptStopper =
      Accounts.validateLoginAttempt((ai /* attempt info */) => {
        if (!ai.allowed) return false;
        // If an establishWithLoginMethod call is in progress and the login
        // method succeeded, then establish the identity
        if (ai.connection._identityIsEstablishing && ai.user) {
          thisIdentityLoginMethodImpl._establishAndThrow(ai.connection,
            ai.user._id);
        }
        if (ai.user._identity) {
          throw new Meteor.Error(403, 'User not found');
        }
        return true;
      }
    );
  }

  // Associate the identity corresponding to the user document with the
  // connection, so that it can be returned by calls to the
  // Identity._getIdentity server method. Always throws the error indicating
  // that the identity was established.
  _establishAndThrow(connection, userId) {
    let identity = {
      serviceName: 'loginMethod',
      id: userId,
    };
    Identity.sign(identity);
    connection._identity = identity;
    throw new Meteor.Error(this.IDENTITY_ESTABLISHED,
      'Identity established.');
  }
}

Identity.loginMethod = new IdentityLoginMethodServerImpl();
