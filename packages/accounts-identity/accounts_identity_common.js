/* globals CREATE_METHOD_NAME: true, AccountsIdentityCommonImpl: true */
CREATE_METHOD_NAME = 'Accounts.identity.create';

AccountsIdentityCommonImpl = class AccountsIdentityCommonImpl {
  constructor() {
  }
  get ACCOUNT_NOT_FOUND() {
    return 'accounts-identity-account-not-found';
  }
  get DUPLICATE_ACCOUNT() {
    return 'accounts-identity-duplicate-account';
  }
};
