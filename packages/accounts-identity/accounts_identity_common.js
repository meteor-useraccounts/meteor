/* globals CREATE_METHOD_NAME: true, ADD_IDENTITY_METHOD_NAME: true,
  REMOVE_IDENTITY_METHOD_NAME: true,  AccountsIdentityCommonImpl: true */

CREATE_METHOD_NAME = 'Accounts.identity.create';
ADD_IDENTITY_METHOD_NAME = 'Accounts.identity.addIdentity';
REMOVE_IDENTITY_METHOD_NAME = 'Accounts.identity.removeIdentity';

AccountsIdentityCommonImpl = class AccountsIdentityCommonImpl {
  constructor() {
  }
  get ACCOUNT_NOT_FOUND() {
    return 'accounts-identity-account-not-found';
  }
  get DUPLICATE_ACCOUNT() {
    return 'accounts-identity-duplicate-account';
  }
  get NOT_LOGGED_IN() {
    return 'accounts-identity-not-logged-in';
  }
};
