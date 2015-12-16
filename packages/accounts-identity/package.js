/* globals Package */

Package.describe({
  summary: 'A login service for identities created by the `identity` package.',
  version: '0.0.1',
});

Package.onUse(function onUseCB(api) {
  api.use('underscore', ['client', 'server']);
  api.use('ecmascript', ['client', 'server']);
  api.use('check', ['client', 'server']);
  api.use('accounts-base', ['client', 'server']);
  api.use('promise', ['client', 'server']);
  api.use('identity', ['server']);

  api.imply('accounts-base');

  api.addFiles('errback.js', ['client', 'server']);
  api.addFiles('accounts_identity_common.js', ['client', 'server']);
  api.addFiles('accounts_identity_server.js', 'server');
  api.addFiles('accounts_identity_client.js', 'client');
});

Package.onTest(function onTestCB(api) {
  api.use([
    'accounts-identity',
    'identity',
    'tinytest',
    'test-helpers',
    'underscore',
    'ecmascript',
    'accounts-base',
    'promise',
    'random',
    'check',
  ]);

  api.addFiles('errback.js', ['client', 'server']);
  api.addFiles('accounts_identity_client_tests.js', 'client');
  api.addFiles('accounts_identity_server_tests.js', 'server');
});
