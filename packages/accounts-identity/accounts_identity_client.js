/* globals AccountsIdentityCommonImpl, Errback, CREATE_METHOD_NAME */

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
  }

  getIdentities() {
  }

  removeIdentity(identity) {
  }
}

Accounts.identity = new AccountsIdentityImpl();
