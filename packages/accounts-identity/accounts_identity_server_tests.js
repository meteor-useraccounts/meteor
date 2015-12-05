/* globals Identity */

Meteor.methods({
  'Accounts.identity.test.reset': function() {
    Meteor.users.remove({});
  },
  'Accounts.identity.test.signIdentity': function(identity) {
    Identity.sign(identity);
    return {
      identity: identity,
    };
  },
});
