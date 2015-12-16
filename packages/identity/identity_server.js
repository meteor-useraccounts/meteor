/* globals SecretCollection: true, Identity: true, Mongo, check, Random, Meteor,
 Match, Npm, IdentityCommonImpl, _, Log */

 /* eslint new-cap: [2, {
      "capIsNewExceptions": ["ObjectIncluding"]
    }] */

// The collection of secrets in the db.
SecretCollection = new Mongo.Collection('Identity._secrets');

class Secrets extends Map {
  constructor(maxSecretAgeMs) {
    check(maxSecretAgeMs, Number);
    super();
    let self = this;

    // Identities signed with secrets older than this will be rejected
    self.maxSecretAgeMs = maxSecretAgeMs;

    // The most recent secret
    self._currentSecret = null;

    // Keep the current secrets in memory for fast lookup
    self._observeStopper = SecretCollection.find({
      when: { $gt: Date.now() - self.maxSecretAgeMs },
    }).observe({
      added(secret) {
        self.set(secret._id, secret);
        if (!self._currentSecret ||
            self._currentSecret.when < secret.when) {
          self._currentSecret = secret;
        }
      },
    });

    // Periodically update the current secret and remove expired secrets.
    self._timeoutHandle = manageSecrets();

    // Add a new secret whenever self._currentSecret is half way through
    // its useful life, and remove any expired secrets so we don't leak memory.
    function manageSecrets() {
      let currentSecret = self._currentSecret;
      if (!currentSecret ||
          (currentSecret.when + self.maxSecretAgeMs / 2) < Date.now()) {
        let secret = {
          when: Date.now(),
          key: Random.secret(),
        };
        // Calling insert will call our `added` observer to be called which
        // will cause self._currentSecret to be set.
        secret._id = SecretCollection.insert(secret);
        currentSecret = secret;
      }

      // Remove any expired secrets
      for (let [id, s] of self) {
        if (s.when + self.maxSecretAgeMs < Date.now()) {
          self.delete(id);
        }
      }

      // Wait until the current secret is half way through its useful life...
      let delay = currentSecret.when + self.maxSecretAgeMs / 2 - Date.now();
      // ...minus a little jitter so that a multi-server setup doesn't flood
      // the DB...
      delay = delay - Math.random() * 1000;
      // ...but make sure that the delay is not negative
      delay = Math.max(0, delay);
      self._timeoutHandle = Meteor.setTimeout(manageSecrets, delay);
      return self._timeoutHandle;
    }
  }

  getCurrent() {
    return this._validateSecret(this._currentSecret, 'Current secret');
  }

  getForIdentity(identity) {
    check(identity, Match.ObjectIncluding({ _keyId: String }));
    let secret = this.get(identity._keyId);
    return this._validateSecret(secret, `Secret for keyId ${identity._keyId}`);
  }

  stop() {
    let self = this;
    if (self._timeoutHandle) {
      Meteor.clearTimeout(self._timeoutHandle);
      delete self._timeoutHandle;
    }
    if (self._observeStopper) {
      self._observeStopper.stop();
      delete self._observeStopper;
    }
  }

  _validateSecret(secret, desc) {
    let self = this;
    if (!secret) {
      throw new Error(`${desc} is not available`);
    }
    if (secret.when < Date.now() - self.maxSecretAgeMs) {
      throw new Error(
        `${desc} is more than ${self.maxSecretAgeMs}ms old`);
    }
    return secret;
  }
}


let jwt = Npm.require('jsonwebtoken');

class IdentityServerImpl extends IdentityCommonImpl {
  constructor() {
    super();
    let self = this;

    // A Secrets object that manages the secrets. This is automatically set
    // byt the setter for this.maxSecretAgeMs.
    self._secrets = null;

    // Identities signed with secrets older than this will be rejected
    self.maxSecretAgeMs = 2 * 24 * 60 * 60 * 1000;

    // The secrets are stored in the database. If `additionalSecret` is set, it
    // will be combined with the secrets in the database, so that an attacker
    // would need to know both `additionalSecret` and a recent secret in the
    // database in order to sign identities. An identity signed while
    // `additionalSecret` has a particular value will only verify when
    // `additionalSecret` has the same value.
    let settings = Meteor.settings.identity;
    self.additionalSecret = settings && settings.additionalSecret || '';
  }

  set maxSecretAgeMs(val) {
    check(val, Number);
    let self = this;
    if (self._secrets) {
      self._secrets.stop();
    }
    self._secrets = new Secrets(val);
  }

  get maxSecretAgeMs() {
    return this._secrets.maxSecretAgeMs;
  }

  sign(identity) {
    check(identity, Match.ObjectIncluding({
      serviceName: String,
      id: String,
    }));
    let self = this;
    let secret = self._secrets.getCurrent();
    let payload =
      _.omit(identity, 'serviceName', 'id', 'when', '_keyId', '_jwt');
    payload._keyId = secret._id;
    identity._jwt = jwt.sign(payload, self.additionalSecret + secret.key, {
      issuer: identity.serviceName,
      subject: identity.id,
    });
    let decoded = jwt.decode(identity._jwt);
    identity.when = decoded.iat;
    identity._keyId = secret._id;
  }

  verify(identity) {
    check(identity, Match.ObjectIncluding({
      serviceName: String,
      id: String,
      when: Number,
      _jwt: String,
      _keyId: String,
    }));
    let self = this;

    let payload;
    try {
      let secret = self._secrets.getForIdentity(identity);
      payload = jwt.verify(identity._jwt, self.additionalSecret + secret.key, {
       issuer: identity.serviceName,
      });
      if (identity.when !== payload.iat) {
        throw new Error(
          `when mismatch: expected ${identity.when} got ${payload.iat}`);
      }
      if (identity.id !== payload.sub) {
        throw new Error(
          `subject mismatch: expected ${identity.id} got ${payload.sub}`);
      }
      if (identity._keyId !== payload._keyId) {
        throw new Error(
          `keyid mismatch: expected ${identity._keyId} got ${payload._keyId}`);
      }
      let actual = _.omit(payload, 'iat', 'iss', 'sub');
      actual.when = payload.iat;
      actual.id = payload.sub;
      actual.serviceName = payload.iss;
      actual._jwt = identity._jwt;
      if (!_.isEqual(identity, actual)) {
        throw new Error(
          `other payload mismatch: expected ${identity} got ${actual}`);
      }
    } catch (err) {
      Log.warn(`Identity verification failed with ${err}`);
      // Always throw VERIFICATION_FAILED to minimize info available to
      // attackers.
      throw new Meteor.Error(self.VERIFICATION_FAILED,
        'Identify verification failed');
    }
  }
}

Identity = new IdentityServerImpl();
