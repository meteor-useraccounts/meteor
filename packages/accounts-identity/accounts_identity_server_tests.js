/* globals Identity, Meteor */

Meteor.methods({
  'Accounts.identity.test.reset': () => { Meteor.users.remove({}); },
  'Accounts.identity.test.signIdentity': (identity) => {
    Identity.sign(identity);
    return {
      identity: identity,
    };
  },
});
