/* globals Package */

Package.describe({
  summary: 'An identity service for identities established with ' +
    'Meteor.loginWith<service>',
  version: '0.0.1',
});

Package.onUse(function onUseCB(api) {
  api.use('underscore', ['client', 'server']);
  api.use('ecmascript', ['client', 'server']);
  api.use('check', ['client', 'server']);
  api.use('callback-hook', ['client', 'server']);
  api.use('reactive-dict', ['client', 'server']);
  api.use('tracker', ['client', 'server']);
  api.use('accounts-base', ['client', 'server']);
  api.use('ddp', ['server']);
  api.use('identity', ['client', 'server']);
  api.use('logging', ['client']);

  api.imply('identity');

  api.addFiles('identity_login_method_common.js', ['client', 'server']);
  api.addFiles('identity_login_method_server.js', 'server');
  api.addFiles('identity_login_method_client.js', 'client');
});

Package.onTest(function onTestCB(api) {
  api.use([
    'identity-login-method',
    'tinytest',
    'test-helpers',
    'underscore',
    'ecmascript',
    'accounts-base',
    'random',
  ]);

  api.addFiles('identity_login_method_client_tests.js', 'client');
  api.addFiles('identity_login_method_server_tests.js', 'server');
});
