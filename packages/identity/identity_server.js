/* jshint esnext: true */

class IdentityServerImpl extends IdentityCommonImpl {
  constructor() {
    super();
    let Accounts = 
      Package['accounts-base'] && Package['accounts-base'].Accounts;
    
    let DDP = Package.ddp && Package.ddp.DDP;
      
    if (! (Accounts && DDP)) {
      console.log('Server does not support establishWithLoginMethod');
      return;
    }
    Meteor.methods({
      // Set a flag on the current connection that we can check from our
      // `Accounts.validateNewUser` and `Accounts.validateLoginAttempt`
      // callbacks. When it is set, those callbacks will upsert the user's
      // identity, associate it with the current connection and return
      // Meteor.Error(Identity.IDENTITY_ESTABLISHED)
      'Identity._setEstablishing': function (flag) {
        this.connection._identityIsEstablishing = flag;
      },
      // Return the identity set on the current connection by our
      // `Accounts.validateNewUser` and `Accounts.validateLoginAttempt`
      // callbacks.
      'Identity._getIdentity': function () {
        return this.connection._identity;
      }
    });

    let thisIdentityImpl = this;
    this._validateNewUserStopper = Accounts.validateNewUser((user) => {
      let invoc = 
        DDP && DDP._CurrentInvocation && DDP._CurrentInvocation.get();
      let connection =
        invoc && invoc.connection;
      if (! (connection && connection._identityIsEstablishing)) {
        return true;
      }

      user._identity = {
        // TODO: Add tokens, etc. to user for verification        
      }
      var userId;
      try {
        userId = Accounts.users.insert(user);
      } catch (e) {
        // XXX string parsing sucks, maybe
        // https://jira.mongodb.org/browse/SERVER-3069 will get fixed one day
        if (e.name !== 'MongoError') throw e;
        if (e.code !== 11000) throw e;
        if (e.err.indexOf('emails.address') !== -1)
          throw new Meteor.Error(403, "Email already exists.");
        if (e.err.indexOf('username') !== -1)
          throw new Meteor.Error(403, "Username already exists.");
        // XXX better error reporting for services.facebook.id duplicate, etc
        throw e;
      }
      thisIdentityImpl._establishIdentityAndThrow(connection, userId);
    });
    
    this._validateLoginAttemptStopper = 
      Accounts.validateLoginAttempt((ai /* attempt info */) => {
        if (! ai.allowed) return false;
        // If an establishWithLoginMethod call is in progress and the login
        // method succeeded, then establish the identity
        if (ai.connection._identityIsEstablishing && ai.user) {
          // TODO: Update tokens, etc for verification
          thisIdentityImpl._establishIdentityAndThrow(ai.connection, 
            ai.user._id);
        }
        if (ai.user._identity) {
          throw new Meteor.Error(403, 'User not found');
        }
        return true;
    });
  }
  
  registerService(service) {
    check(service, Match.ObjectIncluding({
      verify: Function,
    }));
    return super.registerService(service);
  }
  
  verifyIdentityFromLoginMethod(identity) {
    if (identity.serviceName !== 'loginMethod') {
      throw new Meteor.Error(this.VERIFICATION_FAILED);
    }
    return identity.id;
  }
  
  // Associate the identity corresponding to the user document with the
  // connection, so that it can be returned by calls to the
  // Identity._getIdentity server method. Always throws the error indicating
  // that the identity was established.
  _establishIdentityAndThrow(connection, userId) {
    connection._identity = {
      serviceName: 'loginMethod',
      id: userId
      // TODO: Add tokens, etc. for verification
    };
    throw new Meteor.Error(this.IDENTITY_ESTABLISHED, 
      'Identity established.');    
  }
}

Identity = new IdentityServerImpl();
