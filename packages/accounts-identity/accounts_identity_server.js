/* globals AccountsIdentityCommonImpl, CREATE_METHOD_NAME, Identity, Meteor,
/* check, _, Match, Accounts */
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
  }
}

Accounts.identity = new AccountsIdentityServerImpl(Accounts);
