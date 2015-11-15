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
        if (result.serviceName === thisProvider.name) {
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
      serviceName: prov.name,
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
      serviceName: prov.name,
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
