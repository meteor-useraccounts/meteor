/* globals Meteor, _, Accounts, Identity, */

 Accounts.removeDefaultRateLimit();
 
// The FakeLoginService just creates users that record the arguments passed to
// Identity.loginMethod.test.create. Then the login handler will return
// that user whenever options.identityFakeLoginService is an array of the same
// arguments.
Meteor.methods({
  // Used by client test of establishWith
  'Identity.loginMethod.test.create': function create(/* arguments */) {
    let self = this;
    let args = _.toArray(arguments);
    return Accounts._loginMethod(
      self,
      'Identity.loginMethod.test.create',
      arguments,
      'identityFakeLoginService',
      () => {
        return {
          userId: Accounts.insertUserDoc({ /* options */ }, {
            services: {
              'identityFakeLoginService': {
                args: args,
              },
            },
          }),
        };
      }
    );
  },
});

Accounts.registerLoginHandler('identityFakeLoginService', (options) => {
  if (!options.identityFakeLoginService) {
    return undefined;
  }
  let user = Meteor.users.findOne({
    'services.identityFakeLoginService.args': options.identityFakeLoginService,
  });
  if (!user) {
    return {
      error: new Meteor.Error(403, 'User not found'),
    };
  }
  return {
    userId: user._id,
  };
});

Meteor.methods({
  'Identity.loginMethod.test.getVerifiedIdentityRecord': (identity) => {
    Identity.verify(identity);
    return Meteor.users.findOne(identity.id);
  },
});
