/* jshint esnext: true */

class StubIdentityServiceProvider {
  constructor(name, supportsCreate) {
    this.name = name;
    this.valToReturn = { returnedBy: name };
    this.resultOnCompletion = { identity: { serviceName: name } };
    this.errorOnCompletion = new Error(`errorFrom ${name}`);
    this.authenticateCalls = [];
    this.service = {
      name: name,
      authenticate: (options) => {
        this.authenticateCalls.push(options);
        Identity.fireAttemptCompletion(this.errorOnCompletion,
          this.resultOnCompletion);
        return this.valToReturn;
      }
    };
    if (supportsCreate) {
      this.createCalls = [];
      this.service.create = (options) => {
        this.createCalls.push(options);
        Identity.fireAttemptCompletion(this.errorOnCompletion,
          this.resultOnCompletion);
        return this.valToReturn;
      };
    }      
    this.onCompletionCalls = [];
    let thisProvider = this;
    this.onCompletionStopper = Identity.onAttemptCompletion(
      function (error, result) {
        if (result && result.identity.serviceName === thisProvider.name) {
          thisProvider.onCompletionCalls.push({ error: error, result: result });
        }
      }
    );
  }
}

Tinytest.add("identity - duplicate service", (test) => {
  let prov = new StubIdentityServiceProvider('duplicate service');
  Identity.registerService(prov.service);
  test.throws(() => { Identity.registerService(prov.service); },
    Identity.SERVICE_ALREADY_REGISTERED);
});

Tinytest.add("identity - missing service", (test) => {
  test.throws(() => { Identity.create('missing service', {}); },
    Identity.SERVICE_NOT_FOUND);
  test.throws(() => { Identity.authenticate('missing service', {}); },
    Identity.SERVICE_NOT_FOUND);
});

Tinytest.add("identity - delegation to service with create", (test) => {
  let prov = new StubIdentityServiceProvider('service with create', true);
  Identity.registerService(prov.service);
  
  let retVal;
  let options = {
    serviceName: prov.name,
    clientState: 'client state'
  };
  retVal = Identity.create(prov.name, options);
  test.equal(retVal, prov.valToReturn, 'create returns value from service');
  test.equal(prov.createCalls, [options], 'create called');
  test.equal(prov.authenticateCalls, [], 'auth not called');
  test.equal(prov.onCompletionCalls, [{
    error: prov.errorOnCompletion, 
    result: {
      identity: prov.resultOnCompletion.identity,
      methodName: 'create',
      clientState: options.clientState
    }
  }], 'create fires onAttemptCompletion handler called');
  prov.createCalls = [];
  prov.authenticateCalls = [];
  prov.onCompletionCalls = [];
  retVal = Identity.authenticate(prov.name, options);
  test.equal(retVal, prov.valToReturn, 'auth returns value from service');
  test.equal(prov.createCalls, [], 'create not called');
  test.equal(prov.authenticateCalls, [options], 'auth called');
  test.equal(prov.onCompletionCalls, [{
    error: prov.errorOnCompletion, 
    result: {
      identity: prov.resultOnCompletion.identity,
      methodName: 'authenticate',
      clientState: options.clientState
    }
  }], 'auth fires onAttemptCompletion handler called');
});

Tinytest.add("identity - delegation to service without create", (test) => {
  let prov = new StubIdentityServiceProvider('service without create', false);
  Identity.registerService(prov.service);
  
  let retVal;
  let options = {
    serviceName: prov.name
  };
  retVal = Identity.create(prov.name, options);
  test.isFalse(retVal, 'create returns false');
  test.equal(prov.authenticateCalls, [], 'auth not called');
  retVal = Identity.authenticate(prov.name, options);
  test.equal(retVal, prov.valToReturn, 'auth returns value from service');
  test.equal(prov.authenticateCalls, [options], 'auth called');
});


// The FakeLoginService just creates users that record the arguments passed to
// createWithFakeLoginService. Then a call to loginWithFakeLoginService with the
// same arguments will return that user.
function createWithFakeLoginService(param1, param2, callback) {
  Accounts.callLoginMethod({
    methodName: 'Identity.test.createWithFakeLoginService',
    methodArguments: [param1, param2],
    userCallback: callback
  });
}
function loginWithFakeLoginService(param1, param2, callback) {
  Accounts.callLoginMethod({
    methodArguments: [{ identityFakeLoginService: [param1, param2] } ],
    userCallback: callback
  });
}


Tinytest.addAsync("identity - FakeLoginService", (test, done) => {
  // Test that FakeLoginService can be trusted to work correctly in other tests.
  Identity._isEstablishing = false;
  let args = [Random.id(), Random.id()];
  let userId;
  Meteor.logout((err) => {
    test.isUndefined(err, `Error during logout: ${err}`);
    createWithFakeLoginService(args[0], args[1], (err) => {
      test.isUndefined(err, `Error during createWithFakeLoginService: ${err}`);
      userId = Meteor.userId();
      test.isNotNull(userId, 'Not logged in by createWithFakeLoginService');
      Meteor.logout((err) => {
        test.isUndefined(err, `Error during logout: ${err}`);
        test.isNull(Meteor.userId(), 'Not logged out');        
        loginWithFakeLoginService(args[0], args[1], (err) => {
          test.isUndefined(err, 
            `Error during loginWithFakeLoginService: ${err}`);
          test.isNotNull(Meteor.userId(), 
            'Not logged in by loginWithFakeLoginService');
          test.equal(Meteor.userId(), userId);
          done();
        });
      });
    });
  });
});

Tinytest.addAsync("identity - establishWithLoginMethod", (test, done) => {
  // Test creating and using identities via the FakeLoginService
  Identity._isEstablishing = false;
  let args = [Random.id(), Random.id()];
  createWithEstablish();
  function createWithEstablish() {
    Identity.establishWithLoginMethod(createWithFakeLoginService, args[0], args[1], 
      verifyCreated);
  }
  function verifyCreated(err, result) {
    test.isUndefined(err, `Error during establishWithLoginMethod: ${err}`);
    test.equal(result.identity.serviceName, 'loginMethod');
    Meteor.call('Identity.test.getVerifiedIdentityRecord', result.identity, 
      (err, result) => {
        test.isUndefined(err, 'Error verifying identity: ${err}');
        test.equal(result.services.identityFakeLoginService.args, args, 'args');
        verifyLoginFails();
    });    
  }
  function verifyLoginFails() {
    loginWithFakeLoginService(args[0], args[1], (err, result) => {
      test.instanceOf(err, Meteor.Error, 'expected an error');
      // Should react as though the user doesn't exist so that an attacker
      // can't fish for users by checking error messages.
      test.equal(err.error, 403);
      test.equal(err.reason, "User not found");      
      authenticateWithEstablish();
    });
  }
  function authenticateWithEstablish() {
    Identity.establishWithLoginMethod(loginWithFakeLoginService, args[0], args[1], 
      verifyAuthenticated);    
  }
  
  function verifyAuthenticated(err, result) {
    test.isUndefined(err, `Error during establishWithLoginMethod: ${err}`);
    test.equal(result.identity.serviceName, 'loginMethod');
    Meteor.call('Identity.test.getVerifiedIdentityRecord', result.identity, 
      (err, result) => {
        test.isUndefined(err, 'Error verifying identity: ${err}');
        test.equal(result.services.identityFakeLoginService.args, args, 'args');
        done();
    });    
  }
});
