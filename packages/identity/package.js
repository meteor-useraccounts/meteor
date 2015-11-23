Package.describe({
  summary: "An identity system",
  version: "0.0.1"
});

Package.onUse(function (api) {
  api.use('underscore', ['client', 'server']);
  api.use('ecmascript', ['client', 'server']);
  api.use('check', ['client', 'server']);
  api.use('callback-hook', ['client', 'server']);
  api.use('reactive-dict', ['client', 'server']);
  api.use('tracker', ['client', 'server']);
  api.use('accounts-base', ['client', 'server'], { weak: true });
  api.use('ddp', ['server'], { weak: true });

  api.export('Identity', ['client', 'server']);

  api.addFiles('identity_common.js', ['client', 'server']);
  api.addFiles('identity_server.js', 'server');
  api.addFiles('identity_client.js', 'client');
});

Package.onTest(function (api) {
  api.use([
    'identity',
    'tinytest',
    'test-helpers',
    'underscore',
    'ecmascript',
    'accounts-base',
    'random'
  ]);

  api.addFiles('identity_client_tests.js', 'client');
  api.addFiles('identity_server_tests.js', 'server');
});
