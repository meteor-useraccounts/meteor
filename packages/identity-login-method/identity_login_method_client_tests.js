/* globals Accounts, Tinytest, Identity, Random, Meteor */

// The FakeLoginService just creates users that record the arguments passed to
// createWithFakeLoginService. Then a call to loginWithFakeLoginService with the
// same arguments will return that user.
function createWithFakeLoginService(param1, param2, callback) {
  Accounts.callLoginMethod({
    methodName: 'Identity.loginMethod.test.create',
    methodArguments: [param1, param2],
    userCallback: callback,
  });
}
function loginWithFakeLoginService(param1, param2, callback) {
  Accounts.callLoginMethod({
    methodArguments: [{ identityFakeLoginService: [param1, param2] } ],
    userCallback: callback,
  });
}

Tinytest.addAsync('identity-login-method - FakeLoginService', (test, done) => {
  // Test that FakeLoginService can be trusted to work correctly in other tests.
  Identity._isEstablishing = false;
  let args = [Random.id(), Random.id()];
  let userId;
  Meteor.logout((logoutErr) => {
    test.isUndefined(logoutErr, `Error during logout: ${logoutErr}`);
    createWithFakeLoginService(args[0], args[1], (createErr) => {
      test.isUndefined(createErr,
        `Error during createWithFakeLoginService: ${createErr}`);
      userId = Meteor.userId();
      test.isNotNull(userId, 'Not logged in by createWithFakeLoginService');
      Meteor.logout((logoutErr2) => {
        test.isUndefined(logoutErr2, `Error during logout: ${logoutErr2}`);
        test.isNull(Meteor.userId(), 'Not logged out');
        loginWithFakeLoginService(args[0], args[1], (loginErr) => {
          test.isUndefined(loginErr,
            `Error during loginWithFakeLoginService: ${loginErr}`);
          test.isNotNull(Meteor.userId(),
            'Not logged in by loginWithFakeLoginService');
          test.equal(Meteor.userId(), userId);
          done();
        });
      });
    });
  });
});

Tinytest.addAsync('identity-login-method - establishWith', (test, done) => {
  Identity.registerService({
    name: 'with-fake-login-method',
    create: (options) => {
      Identity.loginMethod.establishWith(createWithFakeLoginService,
        options.fakeLoginService.args[0], options.fakeLoginService.args[1]);
    },
    authenticate: (options) => {
      Identity.loginMethod.establishWith(loginWithFakeLoginService,
        options.fakeLoginService.args[0], options.fakeLoginService.args[1]);
    },
  });
  // Test creating and using identities via the FakeLoginService
  Identity._isEstablishing = false;
  let args = [Random.id(), Random.id()];
  createWithEstablish();
  function createWithEstablish() {
    Identity.create('with-fake-login-method', {
      fakeLoginService: {
        args: args,
      },
    }, verifyCreated);
  }
  function verifyCreated(err, result) {
    test.isUndefined(err, `Error during establishWith: ${err}`);
    test.equal(result.identity.serviceName, 'loginMethod');
    Meteor.call('Identity.loginMethod.test.getVerifiedIdentityRecord',
      result.identity,
      (getIdentityErr, getIdentityResult) => {
        test.isUndefined(getIdentityErr,
          'Error verifying identity: ${getIdentityErr}');
        test.equal(getIdentityResult.services.identityFakeLoginService.args,
          args, 'args');
        verifyLoginFails();
      }
    );
  }
  function verifyLoginFails() {
    loginWithFakeLoginService(args[0], args[1], (err) => {
      test.instanceOf(err, Meteor.Error, 'expected an error');
      // Should react as though the user doesn't exist so that an attacker
      // can't fish for users by checking error messages.
      test.equal(err.error, 403);
      test.equal(err.reason, 'User not found');
      authenticateWithEstablish();
    });
  }
  function authenticateWithEstablish() {
    Identity.authenticate('with-fake-login-method', {
      fakeLoginService: {
        args: args,
      },
    }, verifyAuthenticated);
  }

  function verifyAuthenticated(err, result) {
    test.isUndefined(err, `Error during establishWith: ${err}`);
    test.equal(result.identity.serviceName, 'loginMethod');
    Meteor.call('Identity.loginMethod.test.getVerifiedIdentityRecord',
      result.identity,
      (getIdentityErr, getIdentityResult) => {
        test.isUndefined(getIdentityErr,
          'Error verifying identity: ${getIdentityErr}');
        test.equal(getIdentityResult.services.identityFakeLoginService.args,
          args, 'args');
        done();
      }
    );
  }
});
