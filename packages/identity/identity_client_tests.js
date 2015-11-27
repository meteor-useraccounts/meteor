/* jshint esnext: true */

class StubIdentityServiceProvider {
  constructor(name, supportsCreate) {
    let self = this;
    self.name = name;
    self.valToReturn = { returnedBy: name };
    self.resultOnCompletion = { identity: { serviceName: name } };
    self.errorOnCompletion = undefined;
    self.authenticateCalls = [];
    self.service = {
      name: name,
      authenticate(options) {
        self.authenticateCalls.push(options);
        Identity.fireAttemptCompletion(self.errorOnCompletion,
          self.resultOnCompletion);
        return self.valToReturn;
      }
    };
    if (supportsCreate) {
      self.createCalls = [];
      self.service.create = (options) => {
        self.createCalls.push(options);
        Identity.fireAttemptCompletion(self.errorOnCompletion,
          self.resultOnCompletion);
        return self.valToReturn;
      };
    }      
    self.onCompletionCalls = [];
    this.onCompletionStopper = Identity.onAttemptCompletion(
      (error, result) => {
        if (result && result.identity.serviceName === self.name) {
          self.onCompletionCalls.push({ error: error, result: result });
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
    serviceName: prov.name
  };
  retVal = Identity.create(prov.name, options);
  test.equal(retVal, prov.valToReturn, 'create returns value from service');
  test.equal(prov.createCalls, [options], 'create called');
  test.equal(prov.authenticateCalls, [], 'auth not called');
  test.equal(prov.onCompletionCalls, [{
    error: prov.errorOnCompletion, 
    result: {
      identity: prov.resultOnCompletion.identity,
      methodName: 'create'
    }
  }], 'create causes onAttemptCompletion handler to be called');
  prov.onCompletionCalls = [];
  test.throws(() => {
    Identity.fireAttemptCompletion(undefined, { 
      identity: { serviceName: prov.name } 
    });
  });
  test.equal(prov.onCompletionCalls, [], 
    'only first call to fireAttemptCompletion should work w/o context');
  
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
      methodName: 'authenticate'
    }
  }], 'auth causes onAttemptCompletion handler to be called');

  prov.onCompletionCalls = [];
  test.throws(() => {
    Identity.fireAttemptCompletion(undefined, { 
      identity: { serviceName: prov.name } 
    });
  });
  test.equal(prov.onCompletionCalls, [], 
    'only first call to fireAttemptCompletion should work w/o context');
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

Tinytest.add("identity - fireAttemptCompletion without _ctx", (test) => {
  let attemptCompletionCalls = [];
  let stopper = Identity.onAttemptCompletion((...args) => {
    attemptCompletionCalls.push(args);
  });

  let expectedResult = {
    methodName: 'create',
    identity: {
      serviceName: 'dummyServiceName'
    }
  };
  attemptCompletionCalls = [];
  Identity.fireAttemptCompletion(undefined, expectedResult);
  test.equal(attemptCompletionCalls, [[undefined, expectedResult]], 
    'with all props present');
  
  attemptCompletionCalls = [];
  test.throws(() => {
    Identity.fireAttemptCompletion(undefined, {
      identity: {
        serviceName: 'dummyServiceName'
      }
    });
  });
  test.throws(() => {
    Identity.fireAttemptCompletion(undefined, {
      methodName: 'create',
      identity: {
      }
    });
  });
  test.equal(attemptCompletionCalls, [], 'not called if missing props');

  stopper.stop();
});
