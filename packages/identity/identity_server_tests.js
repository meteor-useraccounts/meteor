/* jshint esnext: true */

Tinytest.add("identity - sign and verify", (test) => {
  let identity1 = {
    serviceName: 'service1',
    id: 'id1'
  };
  Identity.sign(identity1);
  let curTime = Date.now();
  test.isTrue(curTime/1000 - identity1.when < 1, 'just created');
  Identity.verify(identity1);

  let identity2 = {
    serviceName: 'service2',
    id: 'id2',
  };
  // Add another property with a random name to be sure it is signed as well
  let propName = `testProp${Random.id()}`;
  identity2[propName] = 'testValue';
  
  Identity.sign(identity2);
  Identity.verify(identity2);  
  
  // Tamper with the id
  identity2.id = 'id1';
  Log._suppress(1);
  test.throws(() => { Identity.verify(identity2); }, 'verification failed');
  identity2.id = 'id2';
  Identity.verify(identity2);

  // Tamper with the service
  identity2.serviceName = 'service1';
  Log._suppress(1);
  test.throws(() => { Identity.verify(identity2); }, 'verification failed');
  identity2.serviceName = 'service2';
  Identity.verify(identity2);
  
  // Tamper with when it was signed
  identity2.when += 1;
  Log._suppress(1);
  test.throws(() => { Identity.verify(identity2); }, 'verification failed');
  identity2.when -= 1;

  // Tamper with extra property
  identity2[propName] = 'changedValue';
  Log._suppress(1);
  test.throws(() => { Identity.verify(identity2); }, 'verification failed');
  identity2[propName] = 'testValue';
});

Tinytest.add("identity - sign and verify multi-server", (test) => {
  let IdentityServerImpl = Object.getPrototypeOf(Identity).constructor;
  let IdentityServer1 = new IdentityServerImpl();
  let IdentityServer2 = new IdentityServerImpl();
  
  let identity = {
    serviceName: 'service',
    id: 'id'
  };
  IdentityServer1.sign(identity);
  IdentityServer2.verify(identity);
});

Tinytest.add("identity - reject old secrets, maintain a fresh one", (test) => {
  let identity = {
    serviceName: 'service',
    id: 'id'
  };
  Identity.sign(identity);
  Identity.verify(identity);
  let origMaxSecretAgeMs = Identity.maxSecretAgeMs;
  try {
    Identity.maxSecretAgeMs = 100;
    Meteor._sleepForMs(101);
    Log._suppress(1);
    test.throws(() => { Identity.verify(identity); }, 'verification failed');
    // Make sure we can still sign identities and verified ones that have been
    // signed since the old secret expired. This tests that a new secret is
    // being used.
    Identity.sign(identity);
    Identity.verify(identity);
  } finally {
    Identity.maxSecretAgeMs = origMaxSecretAgeMs;    
  }
  // Just for good measure, check that our changes to maxSecretAgeMs didn't
  // break anything.
  Identity.sign(identity);
  Identity.verify(identity);
});

Tinytest.add("identity - additionalSecret used", (test) => {
  let identity = {
    serviceName: 'service',
    id: 'id'
  };
  Identity.sign(identity);
  Identity.verify(identity);
  Identity.additionalSecret = 'secret1';
  Log._suppress(1);
  test.throws(() => { Identity.verify(identity); }, 'verification failed');

  Identity.sign(identity);
  Identity.verify(identity);
  Identity.additionalSecret = 'secret2';
  Log._suppress(1);
  test.throws(() => { Identity.verify(identity); }, 'verification failed');
  
  let origIdentitySettings = Meteor.settings.identity;
  try {
    Meteor.settings.identity = { additionalSecret: 'secret1' };
    let IdentityServerImpl = Object.getPrototypeOf(Identity).constructor;
    let IdentityServer1 = new IdentityServerImpl();
    IdentityServer1.verify(identity);
  } finally {
    Meteor.settings.identity = origIdentitySettings;
  }
});
