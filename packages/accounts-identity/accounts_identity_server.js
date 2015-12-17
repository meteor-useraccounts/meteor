/* globals AccountsIdentityCommonImpl, CREATE_METHOD_NAME,
  ADD_IDENTITY_METHOD_NAME, REMOVE_IDENTITY_METHOD_NAME, Identity, Meteor,
  check, _, Match, Accounts */

/* eslint new-cap: [2, {"capIsNewExceptions": ["ObjectIncluding"]}] */

class AccountsIdentityServerImpl extends AccountsIdentityCommonImpl {
  constructor(Accounts) {
    super();
    const self = this;
    Meteor.methods({
      [CREATE_METHOD_NAME]: function create(identity, accountDoc) {
        return Accounts._loginMethod(
          this,
          'create',
          arguments,
          'identity',
          () => {
            check(identity, Object);
            check(accountDoc, Object);
            if (Accounts._options.forbidClientAccountCreation) {
              return {
                error: new Meteor.Error(403, 'Signups forbidden'),
              };
            }
            Identity.verify(identity);

            accountDoc.services = {
              identity: {
                identities: [ _.pick(identity, 'serviceName', 'id') ],
                notSignedBefore: Math.floor(Date.now() / 1000),
              },
            };
            let userId;
            try {
              userId =
                Accounts.insertUserDoc({ identity: identity }, accountDoc);
            } catch (e) {
              // XXX string parsing sucks, maybe
              // https://jira.mongodb.org/browse/SERVER-3069 will get fixed one
              // day
              if (e.name !== 'MongoError') throw e;
              if (e.code !== 11000) throw e;
              if (e.err.indexOf('identities') !== -1) {
                throw new Meteor.Error(self.DUPLICATE_ACCOUNT,
                  'Duplicate account');
              }
              throw e;
            }
            if (!userId) {
              throw new Error('create failed to insert new account');
            }
            // client gets logged in as the new user afterwards.
            return { userId: userId };
          }
        );
      },
      [ADD_IDENTITY_METHOD_NAME]: function addIdentity(identity) {
        check(identity, Match.ObjectIncluding({
          when: Number,
          serviceName: String,
          id: String,
        }));
        let user = Meteor.user();
        if (!user) {
          throw new Meteor.Error(self.NOT_LOGGED_IN, 'Not logged in');
        }
        Identity.verify(identity);
        let modifier = {
          $addToSet: {
            'services.identity.identities':
              _.pick(identity, 'serviceName', 'id'),
          },
        };
        if (!user.services || !user.services.identity ||
            !user.services.identity.notSignedBefore) {
          modifier.$set = {
            'services.identity.notSignedBefore': Math.floor(Date.now() / 1000),
          };
        }
        Meteor.users.update(user._id, modifier);
      },
      [REMOVE_IDENTITY_METHOD_NAME]: function removeIdentity(identity) {
        check(identity, Match.ObjectIncluding({
          serviceName: String,
          id: String,
        }));
        let userId = Meteor.userId();
        if (!userId) {
          throw new Meteor.Error(self.NOT_LOGGED_IN, 'Not logged in');
        }
        Meteor.users.update(userId, {
          $pull: {
            'services.identity.identities': {
              serviceName: identity.serviceName,
              id: identity.id,
            },
          },
        });
      },
    });

    self._observeStopper = Accounts.users.find({
      'services.resume.loginTokens': { $exists: true },
      'services.identity.notSignedBefore': { $exists: true },
    }, {
      fields: {
        'services.resume.loginTokens': 1,
        'services.identity.notSignedBefore': 1,
      },
    }).observe({
      changed(newDoc, oldDoc) {
        const newTokens = newDoc.services.resume.loginTokens;
        const oldTokens = oldDoc.services.resume.loginTokens;

        const curSecs = Math.floor(Date.now() / 1000);
        if (newTokens.length < oldTokens.length &&
            newDoc.services.identity.notSignedBefore < curSecs) {
          Accounts.users.update(oldDoc._id, {
            $set: { 'services.identity.notSignedBefore': curSecs },
          });
        }
      },
    });

    Accounts.registerLoginHandler('identity', (options) => {
      if (!options.identity) {
        return undefined;
      }
      const identity = options.identity;
      check(identity, Match.ObjectIncluding({
        serviceName: String,
        id: String,
      }));
      Identity.verify(identity);
      const user = Accounts.users.findOne({
        'services.identity.identities.serviceName': identity.serviceName,
        'services.identity.identities.id': identity.id,
        'services.identity.notSignedBefore': { $lte: identity.when },
      });
      if (!user) {
        return {
          error: new Meteor.Error(self.ACCOUNT_NOT_FOUND, 'User not found'),
        };
      }
      return {
        userId: user._id,
      };
    });

    Accounts.users._ensureIndex({ 'services.identity.identities': 1 },
      { unique: true });

    Meteor.publish(null, publishIdentities);
  }
}

function publishIdentities() {
  // Add a client-only `identities` property to the current user record
  // and keep it updated to refect the user's identities.
  let self = this;
  // The function to call to notify the subscriber. We initially set it to
  // self.added to workaround meteorhacks:fast-render issue #142
  // (https://github.com/kadirahq/fast-render/issues/142). Once self.added() is
  // called once, we set it to self.changed().
  let updateFunc = self.added.bind(self);

  if (!self.userId) {
    return null;
  }
  let userObserverStopper = Meteor.users.find({
    _id: self.userId,
  }).observeChanges({
    added: updateIdentities,
    changed: updateIdentities,
  });

  self.onStop(() => {
    userObserverStopper.stop();
  });

  self.ready();

  function updateIdentities() {
    let user = Meteor.users.findOne({
      _id: self.userId,
    });
    if (!user) {
      // user has been removed, so no need to change.
      return;
    }
    let identities
      = user.services && user.services.identity &&
        user.services.identity.identities;
    // Get just the serviceName and id fields.
    identities = identities || [];
    identities =
      identities.map((identity) => _.pick(identity, 'serviceName', 'id'));
    updateFunc('users', self.userId, {
      _identities: identities || [],
    });
    updateFunc = self.changed.bind(self);
  }
}

Accounts.identity = new AccountsIdentityServerImpl(Accounts);
