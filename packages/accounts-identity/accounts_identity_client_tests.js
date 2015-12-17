/* globals Identity, Errback, check, Tinytest, Meteor, _, Accounts */

const prefix = 'accounts-identity -';

class AsyncTestImpl {
  add(testName, asyncTestFunc) {
    check(testName, String);
    check(asyncTestFunc, Function);
    Tinytest.addAsync(testName, (test, done) => {
      test.asyncThrows = (asyncFunc, expectedError, message) => {
        return asyncFunc.call(undefined, test).
          then((result) => {
            test.throws(() => result, expectedError, message);
          }).
          catch((error) => {
            test.throws(() => { throw error; }, expectedError, message);
          });
      };
      asyncTestFunc.call(undefined, test).then(done, (error) => {
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
  async authenticate(options) {
    return await Errback.promise(cb =>
      Meteor.call('Accounts.identity.test.signIdentity', {
        serviceName: fakeServiceName,
        id: options.id,
      }, cb)).then(...Errback.settlers(
        Identity.fireAttemptCompletion.bind(Identity)));
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

AsyncTest.add(`${prefix} create/login`, async (test) => {
  _.extend(test, extraTestMethods);

  // Delete all users
  await Errback.promise(cb => Meteor.call('Accounts.identity.test.reset', cb));

  // Logout
  await Errback.promise(cb => Meteor.logout(cb));
  test.isNull(Meteor.userId(), 'Meteor.userId() is not null');

  // Create a new identity
  const { identity: identity1 } = await Errback.promise(cb =>
    Identity.authenticate('fake-identity-service', { id: 'id1' }, cb));

  // Create an account for the identity and log the user in.
  await Accounts.identity.create(identity1, { profile: { name: 'name1'} });
  test.profileNameEqual('name1');

  // Logout
  await Errback.promise(cb => Meteor.logout(cb));
  test.isNull(Meteor.userId(), 'Meteor.userId() is not null');

  // Create second identity
  const { identity: identity2 } = await Errback.promise(cb =>
    Identity.authenticate('fake-identity-service', { id: 'id2' }, cb));

  // Login should fail because we haven't created an account yet.
  await test.asyncThrows(async () => {
    await Accounts.identity.login(identity2);
  }, Accounts.identity.ACCOUNT_NOT_FOUND,
  'login before create should fail');

  // Create an account for the second identity and log the user in.
  await Accounts.identity.create(identity2, { profile: { name: 'name2'} });
  test.profileNameEqual('name2');

  // Logout
  await Errback.promise(cb => Meteor.logout(cb));
  test.isNull(Meteor.userId(), 'Meteor.userId() is not null');

  // Logging in using the second identity should log us in to the correct
  // account
  const { identity: identity2Reauthed } = await Errback.promise(cb =>
    Identity.authenticate('fake-identity-service', { id: 'id2' }, cb));
  await Accounts.identity.login(identity2Reauthed);
  test.profileNameEqual('name2');

  // Logout
  await Errback.promise(cb => Meteor.logout(cb));
  test.isNull(Meteor.userId(), 'Meteor.userId() is not null');

  // Logging in using the first identity should log us in to the correct
  // account
  const { identity: identity1Reauthed } = await Errback.promise(cb =>
    Identity.authenticate('fake-identity-service', { id: 'id1' }, cb));
  await Accounts.identity.login(identity1Reauthed);
  test.profileNameEqual('name1');
});

function addLogoutTest(testName, logoutFunc) {
  AsyncTest.add(testName, async (test) => {
    _.extend(test, extraTestMethods);

    // Delete all users
    await Errback.promise(cb =>
      Meteor.call('Accounts.identity.test.reset', cb));

    // Logout
    await Errback.promise(cb => Meteor.logout(cb));
    test.isNull(Meteor.userId(), 'Meteor.userId() is not null');

    // Create a new identity
    const { identity: identity1 } = await Errback.promise(cb =>
      Identity.authenticate('fake-identity-service', { id: 'id1' }, cb));

    // Create an account for the identity and log the user in.
    await Accounts.identity.create(identity1, {
      profile: { name: 'name1'},
    });
    test.profileNameEqual('name1');

    // Wait at least one second so that the identity will be considered old when
    // we logout
    await Errback.promise(cb => Meteor.setTimeout(cb, 1000));

    // Logout using logoutFunc
    await Errback.promise(cb => logoutFunc(cb));

    // Logging in again using the same identity should fail because the identity
    // needs to be re-signed.
    await test.asyncThrows(async () => {
      await Accounts.identity.login(identity1);
    }, Accounts.identity.ACCOUNT_NOT_FOUND,
    'login in after logout should require re-signing');

    // Reauthenticate and the login should work.
    const { identity: identity1Reauthed } = await Errback.promise(cb =>
      Identity.authenticate('fake-identity-service', { id: 'id1' }, cb));
    await Accounts.identity.login(identity1Reauthed);
    test.profileNameEqual('name1');
  });
}

addLogoutTest(`${prefix} logout`, Meteor.logout.bind(Meteor));
addLogoutTest(`${prefix} logoutOtherClients`,
  Meteor.logoutOtherClients.bind(Meteor));

AsyncTest.add(`${prefix} create dup`, async (test) => {
  _.extend(test, extraTestMethods);

  // Delete all users
  await Errback.promise(cb => Meteor.call('Accounts.identity.test.reset', cb));

  // Logout
  await Errback.promise(cb => Meteor.logout(cb));
  test.isNull(Meteor.userId(), 'Meteor.userId() is not null');

  // Create a new identity
  const { identity: identity1 } = await Errback.promise(cb =>
    Identity.authenticate('fake-identity-service', { id: 'id1' }, cb));

  // Create an account for the identity and log the user in.
  await Accounts.identity.create(identity1, { profile: { name: 'name1'} });
  test.profileNameEqual('name1');

  // Creating another account for the same identity should fail
  await test.asyncThrows(async () => {
    await Accounts.identity.create(identity1, {
      profile: { name: 'name1'},
    });
  }, Accounts.identity.DUPLICATE_ACCOUNT,
  'create with same identity should fail');

  // Logout
  await Errback.promise(cb => Meteor.logout(cb));
  test.isNull(Meteor.userId(), 'Meteor.userId() is not null');

  // Wait at least one second so that the reauthed identity has a new timestamp
  await Errback.promise(cb => Meteor.setTimeout(cb, 1000));

  // Reauth to get a new identity object for the same user.
  const { identity: identity1Reauthed } = await Errback.promise(cb =>
    Identity.authenticate('fake-identity-service', { id: 'id1' }, cb));

  // Creating another account with the new identity should fail
  await test.asyncThrows(async () => {
    await Accounts.identity.create(identity1Reauthed,
      { profile: { name: 'name1'} });
  }, Accounts.identity.DUPLICATE_ACCOUNT,
  'create with reauthed identity should fail');
});

AsyncTest.add(`${prefix} add/get/remove identity`, async (test) => {
  _.extend(test, extraTestMethods);

  // Delete all users
  await Errback.promise(cb => Meteor.call('Accounts.identity.test.reset', cb));

  // Logout
  await Errback.promise(cb => Meteor.logout(cb));
  test.isNull(Meteor.userId(), 'Meteor.userId() is not null');

  // Create a new identity
  const { identity: identity1 } = await Errback.promise(cb =>
    Identity.authenticate('fake-identity-service', { id: 'id1' }, cb));

  // Check that we can't add the identity if we aren't logged in
  await test.asyncThrows(async () => {
    await Accounts.identity.addIdentity(identity1);
  }, Accounts.identity.NOT_LOGGED_IN,
  'addIdentity() should fail when not logged in');

  // Create an account for the identity and log the user in.
  await Accounts.identity.create(identity1, { profile: { name: 'name1'} });
  test.profileNameEqual('name1');

  // Create a second identity
  const { identity: identity2 } = await Errback.promise(cb =>
    Identity.authenticate('fake-identity-service', { id: 'id2' }, cb));

  // Add the second identity to our account
  await Accounts.identity.addIdentity(identity2);

  // Logout
  await Errback.promise(cb => Meteor.logout(cb));
  test.isNull(Meteor.userId(), 'Meteor.userId() is not null');

  // Login using the second Identity
  await Accounts.identity.login(identity2);

  // Check that we are logged into the same account
  test.profileNameEqual('name1');

  // Logout
  await Errback.promise(cb => Meteor.logout(cb));
  test.isNull(Meteor.userId(), 'Meteor.userId() is not null');

  // Check that we can't get our identities if we aren't logged in
  await test.asyncThrows(async () => {
    await Accounts.identity.getIdentities();
  }, Accounts.identity.NOT_LOGGED_IN,
  'getIdentities() should fail when not logged in');

  // Login
  await Accounts.identity.login(identity1);
  test.profileNameEqual('name1');

  // Get our identities
  let identities = Accounts.identity.getIdentities();
  test.equal(identities, [
    _.pick(identity1, 'serviceName', 'id'),
    _.pick(identity2, 'serviceName', 'id'),
  ], 'wrong identities');

  // Remove the first identity
  await Accounts.identity.removeIdentity(identities[0]);

  // Logout
  await Errback.promise(cb => Meteor.logout(cb));
  test.isNull(Meteor.userId(), 'Meteor.userId() is not null');

  // Confirm that we can't login using the first identity
  await test.asyncThrows(async () => {
    await Accounts.identity.login(identity1);
  }, Accounts.identity.ACCOUNT_NOT_FOUND,
  'login after removeIdentity should fail');

  // Login using the second identity again
  await Accounts.identity.login(identity2);

  // Check that we are logged into the same account
  test.profileNameEqual('name1');
});
