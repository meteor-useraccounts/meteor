/* jshint esnext: true */

class IdentityLoginMethodImpl extends IdentityLoginMethodCommonImpl {
  constructor() {
    super();
    
    // A 'context' object that keeps track of whether a call to 
    // establishWithLoginMethod is in progress on the current connection.
    // This is a persistent ReactiveDict so that it will survive a hot code push
    // or redirect. 
    this._ctx = new ReactiveDict('identity_login_method_ctx');
    
    // Whenever the "establishing" state changes on the client, have the server 
    // change the state associated with the connection as well.
    this._ctx.setDefault('isEstablishing', false);
    this._isEstablishing = this._ctx.get('isEstablishing'); // sync server

    let thisIdentityLoginMethodImpl = this;    
    // The redirect flow of services which use accounts-oauth will pass the
    // result of the login method to onPageLoadLogin callbacks. Register a
    // callback that with complete any establishWithLoginMethod call that is in
    // progress.
    Accounts.onPageLoadLogin((attemptInfo) => {
      var ai = attemptInfo;
      if (ai && ai.error &&
          ai.error.error === thisIdentityLoginMethodImpl.IDENTITY_ESTABLISHED &&
          thisIdentityLoginMethodImpl._isEstablishing) {
        thisIdentityLoginMethodImpl._completeEstablishing(err);
      }
    });
  }
    
  // Whether an establishWithLoginMethod call is in progress
  get _isEstablishing() {
    return this._ctx.get('isEstablishing');
  }
  set _isEstablishing(val) {
    if (val !== this._isEstablishing) {
      Meteor.call('Identity.loginMethod._setEstablishing',
        val,
        (error) => {
          if (error) {
            console.log(
              `Error calling Identity.loginMethod._setEstablishing: ${error}`
            );            
          }
        });
    }
    this._ctx.set('isEstablishing', val);
  }
    
  establishWith(loginMethod, ...args) {
    let callback;

    // Enable "establishng"
    this._isEstablishing = true;
    
    // Create/modify the callback to disable "establishing" and run
    // onAttemptCompletion handlers
    if (_.isFunction(_.last(args))) {
      callback = args.pop();
    }
    let thisIdentityLoginMethodImpl = this;
    callback = _.wrap(callback, function (origCallback, err /*, result*/) {
      if (! err) {
        // This should never happen.
        throw new Error(`${loginMethod.name} failed to return an error`);
      }
      thisIdentityLoginMethodImpl._completeEstablishing(err, origCallback);
    });
    args.push(callback);

    // Call the login method
    return loginMethod.apply(Meteor, args);
  }
  
  _completeEstablishing(err, callback) {
    this._isEstablishing = false;
    if (err.error !== this.IDENTITY_ESTABLISHED) {
      this.fireAttemptCompletion(err);
      if (callback) {
        callback.call(undefined, err);
      }
      return;
    }
    Meteor.call('Identity.loginMethod._getIdentity', (err, identity) => {
      if (callback) {
        let stopper = Identity.onAttemptCompletion((err, result) => {
          stopper.stop();
          callback.call(undefined, err, result);          
        });
      }
      Identity.fireAttemptCompletion(undefined, { identity: identity });
    });
  }
}

Identity.loginMethod = new IdentityLoginMethodImpl();
