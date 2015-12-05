/* globals Identity, Errback */

const prefix = 'accounts-identity -';

function spawn(generator) {
  const firstPromise = new Promise((resolve) => { resolve(); });
  const g = generator();
  return addThen(firstPromise);
  function addThen(promise) {
    const p = Promise.resolve(promise);
    return p.then((retVal) => {
      const next = g.next(retVal);
      if (!next.done) {
        return addThen(next.value);
      }
    });
  }
}

class AsyncTestImpl {
  addGenerator(testName, testGenerator) {
    check(testName, String);
    check(testGenerator, Function);
    Tinytest.addAsync(testName, (test, done) => {
      test.asyncThrows = (generator, expectedError, message) => {
        return spawn(generator.bind(undefined, test)).
          then((result) => {
            test.throws(() => result, expectedError, message);
          }).
          catch((error) => {
            test.throws(() => { throw error; }, expectedError, message);
          });
      };
      spawn(function *() {
        yield* testGenerator.call(undefined, test);
      }).then(done, (error) => {
        test.fail(`Unexpected error: ${error}`);
        done();
      });
    });
  }
}

const AsyncTest = new AsyncTestImpl();

const fakeServiceName = 'fake-identity-service';
Identity.registerService({
  name: fakeServiceName,
  authenticate(options) {
    return spawn(function *() {
      return yield Errback.promise(cb =>
        Meteor.call('Accounts.identity.test.signIdentity', {
          serviceName: fakeServiceName,
          id: options.id,
        }, cb)).then(...Errback.settlers(
          Identity.fireAttemptCompletion.bind(Identity)));
    });
  },
});

const extraTestMethods = {
  profileNameEqual(name) {
    const test = this;
    const context = `in profileNameEquals("${name})`;
    const userId = Meteor.userId();
    test.isNotUndefined(userId, `userId is undefined ${context}`);
    test.isNotNull(userId, `userId is null ${context}`);
    const user = Meteor.user();
    test.isNotUndefined(user, `user is undefined ${context}`);
    test.isNotNull(user, `user is null ${context}`);
    test.equal(user.profile.name, name,
      `unexpected user.profile.name ${context}`);
  },
};

AsyncTest.addGenerator(`${prefix} create/login`, function *(test) {
  _.extend(test, extraTestMethods);

  // Delete all users
  yield Errback.promise(cb => Meteor.call('Accounts.identity.test.reset', cb));

  // Logout
  yield Errback.promise(cb => Meteor.logout(cb));
  test.isNull(Meteor.userId(), 'Meteor.userId() is not null');

  // Create a new identity
  const { identity: identity1 } = yield Errback.promise(cb =>
    Identity.authenticate('fake-identity-service', { id: 'id1' }, cb));

  // Create an account for the identity and log the user in.
  yield Accounts.identity.create(identity1, { profile: { name: 'name1'} });
  test.profileNameEqual('name1');

  // Logout
  yield Errback.promise(cb => Meteor.logout(cb));
  test.isNull(Meteor.userId(), 'Meteor.userId() is not null');

  // Create second identity
  const { identity: identity2 } = yield Errback.promise(cb =>
    Identity.authenticate('fake-identity-service', { id: 'id2' }, cb));

  // Login should fail because we haven't created an account yet.
  yield test.asyncThrows(function *() {
    yield Accounts.identity.login(identity2);
  }, Accounts.identity.ACCOUNT_NOT_FOUND,
  'login before create should fail');

  // Create an account for the second identity and log the user in.
  yield Accounts.identity.create(identity2, { profile: { name: 'name2'} });
  test.profileNameEqual('name2');

  // Logout
  yield Errback.promise(cb => Meteor.logout(cb));
  test.isNull(Meteor.userId(), 'Meteor.userId() is not null');

  // Logging in using the second identity should log us in to the correct
  // account
  const { identity: identity2Reauthed } = yield Errback.promise(cb =>
    Identity.authenticate('fake-identity-service', { id: 'id2' }, cb));
  yield Accounts.identity.login(identity2Reauthed);
  test.profileNameEqual('name2');

  // Logout
  yield Errback.promise(cb => Meteor.logout(cb));
  test.isNull(Meteor.userId(), 'Meteor.userId() is not null');

  // Logging in using the first identity should log us in to the correct
  // account
  const { identity: identity1Reauthed } = yield Errback.promise(cb =>
    Identity.authenticate('fake-identity-service', { id: 'id1' }, cb));
  yield Accounts.identity.login(identity1Reauthed);
  test.profileNameEqual('name1');
});

function addLogoutTest(testName, logoutFunc) {
  AsyncTest.addGenerator(testName, function *(test) {
    _.extend(test, extraTestMethods);

    // Delete all users
    yield Errback.promise(cb =>
      Meteor.call('Accounts.identity.test.reset', cb));

    // Logout
    yield Errback.promise(cb => Meteor.logout(cb));
    test.isNull(Meteor.userId(), 'Meteor.userId() is not null');

    // Create a new identity
    const { identity: identity1 } = yield Errback.promise(cb =>
      Identity.authenticate('fake-identity-service', { id: 'id1' }, cb));

    // Create an account for the identity and log the user in.
    yield Accounts.identity.create(identity1, {
      profile: { name: 'name1'},
    });
    test.profileNameEqual('name1');

    // Wait at least one second so that the identity will be considered old when
    // we logout
    yield Errback.promise(cb => Meteor.setTimeout(cb, 1000));

    // Logout using logoutFunc
    yield Errback.promise(cb => logoutFunc(cb));

    // Logging in again using the same identity should fail because the identity
    // needs to be re-signed.
    yield test.asyncThrows(function *() {
      yield Accounts.identity.login(identity1);
    }, Accounts.identity.ACCOUNT_NOT_FOUND,
    'login in after logout should require re-signing');

    // Reauthenticate and the login should work.
    const { identity: identity1Reauthed } = yield Errback.promise(cb =>
      Identity.authenticate('fake-identity-service', { id: 'id1' }, cb));
    yield Accounts.identity.login(identity1Reauthed);
    test.profileNameEqual('name1');
  });
}

addLogoutTest(`${prefix} logout`, Meteor.logout.bind(Meteor));
addLogoutTest(`${prefix} logoutOtherClients`,
  Meteor.logoutOtherClients.bind(Meteor));

AsyncTest.addGenerator(`${prefix} create dup`, function *(test) {
  _.extend(test, extraTestMethods);

  // Delete all users
  yield Errback.promise(cb => Meteor.call('Accounts.identity.test.reset', cb));

  // Logout
  yield Errback.promise(cb => Meteor.logout(cb));
  test.isNull(Meteor.userId(), 'Meteor.userId() is not null');

  // Create a new identity
  const { identity: identity1 } = yield Errback.promise(cb =>
    Identity.authenticate('fake-identity-service', { id: 'id1' }, cb));

  // Create an account for the identity and log the user in.
  yield Accounts.identity.create(identity1, { profile: { name: 'name1'} });
  test.profileNameEqual('name1');

  // Creating another account for the same identity should fail
  yield test.asyncThrows(function *() {
    yield Accounts.identity.create(identity1, {
      profile: { name: 'name1'},
    });
  }, Accounts.identity.DUPLICATE_ACCOUNT,
  'create with same identity should fail');

  // Logout
  yield Errback.promise(cb => Meteor.logout(cb));
  test.isNull(Meteor.userId(), 'Meteor.userId() is not null');

  // Wait at least one second so that the reauthed identity has a new timestamp
  yield Errback.promise(cb => Meteor.setTimeout(cb, 1000));

  // Reauth to get a new identity object for the same user.
  const { identity: identity1Reauthed } = yield Errback.promise(cb =>
    Identity.authenticate('fake-identity-service', { id: 'id1' }, cb));

  // Creating another account with the new identity should fail
  yield test.asyncThrows(function *() {
    yield Accounts.identity.create(identity1Reauthed,
      { profile: { name: 'name1'} });
  }, Accounts.identity.DUPLICATE_ACCOUNT,
  'create with reauthed identity should fail');
});

/*
Tinytest.addAsync(`${prefix} addIdentity`, (test, done) => {
  test.fail('Not yet implemented');
  done();
});

Tinytest.addAsync(`${prefix} getIdentities`, (test, done) => {
  test.fail('Not yet implemented');
  done();
});

Tinytest.addAsync(`${prefix} removeIdentity`, (test, done) => {
  test.fail('Not yet implemented');
  done();
});
*/
