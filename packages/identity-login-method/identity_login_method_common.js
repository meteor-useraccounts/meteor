/* globals IdentityLoginMethodCommonImpl: true */

IdentityLoginMethodCommonImpl = class IdentityLoginMethodCommonImpl {
  constructor() {
  }

  // Error code indicating that an identity has been established and can be
  // retrieved by calling the `Identity.loginMethod._getIdentity` server method.
  get _IDENTITY_ESTABLISHED() {
    return 'identity-login-method-established-identity';
  }
};
