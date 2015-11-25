/* jshint esnext: true */

Tinytest.add("identity - sign and verify", (test) => {
  let identity1 = {
    serviceName: 'service1',
    id: 'id1'
  };
  Identity.sign(identity1);
  let curTime = Date.now();
  test.isTrue(curTime/1000 - identity1.when < 1000, 'just created');
  Identity.verify(identity1);

  let identity2 = {
    serviceName: 'service2',
    id: 'id2'
  };
  
  Identity.sign(identity2);
  Identity.verify(identity2);  
  
  console.warn('=== Testing identity tampering, expect error messages');
  // Tamper with the id
  identity2.id = 'id1';
  test.throws(() => { Identity.verify(identity2); }, 'verification failed');
  identity2.id = 'id2';
  Identity.verify(identity2);

  // Tamper with the service
  identity2.serviceName = 'service1';
  test.throws(() => { Identity.verify(identity2); }, 'verification failed');
  identity2.serviceName = 'service2';
  Identity.verify(identity2);
  
  // Tamper with when it was signed
  identity2.when += 1;
  test.throws(() => { Identity.verify(identity2); }, 'verification failed');

  console.warn('=== Done testing identity tampering');
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
    console.warn('=== Testing reject of old secrets, expect error messages');
    test.throws(() => { Identity.verify(identity); }, 'verification failed');
    console.warn('=== Done testing reject of old secrets');
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
