/* globals IdentityLoginMethodCommonImpl, ReactiveDict, Accounts, Meteor,
  check, _, Identity, Log */

class IdentityLoginMethodImpl extends IdentityLoginMethodCommonImpl {
  constructor() {
    super();
    let self = this;

    // A 'context' object that keeps track of whether a call to
    // establishWithLoginMethod is in progress on the current connection.
    // This is a persistent ReactiveDict so that it will survive a hot code push
    // or redirect.
    self._ctx = new ReactiveDict('identity_login_method_ctx');

    // Whenever the "establishing" state changes on the client, have the server
    // change the state associated with the connection as well.
    self._ctx.setDefault('isEstablishing', false);
    self._isEstablishing = self._ctx.get('isEstablishing'); // sync server

    // The redirect flow of services which use accounts-oauth will pass the
    // result of the login method to onPageLoadLogin callbacks. Register a
    // callback that will complete any establishWithLoginMethod call that is in
    // progress.
    Accounts.onPageLoadLogin((attemptInfo) => {
      let ai = attemptInfo;
      if (ai && ai.error && ai.error.error === self.IDENTITY_ESTABLISHED &&
          self._isEstablishing) {
        self._completeEstablishing(ai.error);
      }
    });
  }

  // Whether an establishWithLoginMethod call is in progress
  get _isEstablishing() {
    return this._ctx.get('isEstablishing');
  }
  set _isEstablishing(val) {
    let self = this;
    if (val !== self._isEstablishing) {
      Meteor.call('Identity.loginMethod._setEstablishing',
        val,
        (error) => {
          if (error) {
            Log.error(
              `Error calling Identity.loginMethod._setEstablishing: ${error}`
            );
          }
        });
    }
    self._ctx.set('isEstablishing', val);
  }

  establishWith(loginMethod, ...args) {
    check(loginMethod, Function);
    let self = this;
    let callback;

    // Enable "establishng"
    self._isEstablishing = true;

    // Create/modify the callback to disable "establishing" and run
    // onAttemptCompletion handlers
    if (_.isFunction(_.last(args))) {
      callback = args.pop();
    }
    callback = _.wrap(callback, (origCallback, err) => {
      if (!err) {
        // This should never happen.
        throw new Error(`${loginMethod.name} failed to return an error`);
      }
      self._completeEstablishing(err, origCallback);
    });
    args.push(callback);

    // Call the login method
    return loginMethod.apply(Meteor, args);
  }

  _completeEstablishing(err, callback) {
    let self = this;
    self._isEstablishing = false;
    if (err.error !== self.IDENTITY_ESTABLISHED) {
      Identity.fireAttemptCompletion(err);
      if (callback) {
        callback.call(undefined, err);
      }
      return;
    }
    Meteor.call('Identity.loginMethod._getIdentity',
      (getIdentityErr, identity) => {
        if (callback) {
          let stopper =
            Identity.onAttemptCompletion((onAttemptCompletionErr, result) => {
              stopper.stop();
              callback.call(undefined, onAttemptCompletionErr, result);
            }
          );
        }
        Identity.fireAttemptCompletion(undefined, { identity: identity });
      }
    );
  }
}

Identity.loginMethod = new IdentityLoginMethodImpl();
