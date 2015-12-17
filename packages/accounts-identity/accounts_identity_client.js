/* globals AccountsIdentityCommonImpl, Errback, CREATE_METHOD_NAME,
  ADD_IDENTITY_METHOD_NAME, REMOVE_IDENTITY_METHOD_NAME, check, Match,
  Accounts, Meteor */
/* eslint new-cap: [2, {"capIsNewExceptions": ["ObjectIncluding"]}] */

class AccountsIdentityImpl extends AccountsIdentityCommonImpl {
  constructor() {
    super();
  }

  create(identity, accountDoc) {
    check(identity, Match.ObjectIncluding({
      when: Number,
      serviceName: String,
      id: String,
    }));
    check(accountDoc, Object);
    return Errback.promise((cb) => {
      Accounts.callLoginMethod({
        methodName: CREATE_METHOD_NAME,
        methodArguments: [identity, accountDoc],
        userCallback: cb,
      });
    });
  }

  login(identity) {
    check(identity, Match.ObjectIncluding({
      when: Number,
      serviceName: String,
      id: String,
    }));
    return Errback.promise((cb) => {
      Accounts.callLoginMethod({
        methodArguments: [{
          identity: identity,
        }],
        userCallback: cb,
      });
    });
  }

  addIdentity(identity) {
    check(identity, Match.ObjectIncluding({
      when: Number,
      serviceName: String,
      id: String,
    }));
    return Errback.promise((cb) => {
      Meteor.call(ADD_IDENTITY_METHOD_NAME, identity, cb);
    });
  }

  getIdentities() {
    let self = this;
    let user = Meteor.user();
    if (!user) {
      throw Meteor.Error(self.NOT_LOGGED_IN, 'Not logged in');
    }
    return user._identities || [];
  }

  removeIdentity(identity) {
    check(identity, Match.ObjectIncluding({
      serviceName: String,
      id: String,
    }));
    return Errback.promise((cb) => {
      Meteor.call(REMOVE_IDENTITY_METHOD_NAME, identity, cb);
    });
  }
}

Accounts.identity = new AccountsIdentityImpl();
