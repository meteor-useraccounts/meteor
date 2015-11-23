/* jshint esnext: true */

class IdentityImpl extends IdentityCommonImpl {
  constructor() {
    super();
    
    // Hook manging callbacks registered by onAttemptCompletion() and run by
    // fireAttemptCompletion()
    this._completionHook = new Hook({ bindEnvironment: false });
    
    // A 'context' object that keeps track of the most recent
    // create/authenticate invocation and the whether a call to 
    // establishWithLoginMethod is in progress on the current connection.
    // This is a persistent ReactiveDict so that it will survive a hot code push
    // or redirect. The reactive nature is used to keep the server state in sync
    // with the client state.
    // TODO: Allow each IdentityImpl to have it's own reactive dict.
    this._ctx = new ReactiveDict('identity_ctx');
    
    // Whenever the "establishing" state changes on the client, have the server 
    // change the state associated with the connection as well.
    this._ctx.setDefault('isEstablishing', false);
    this._isEstablishing = this._ctx.get('isEstablishing'); // synch server
    let thisIdentityImpl = this;
    
    let Accounts = 
      Package['accounts-base'] && Package['accounts-base'].Accounts;
    
    if (Accounts) {
      // The redirect flow of services which use accounts-oauth will pass the
      // result of the login method to onPageLoadLogin callbacks. Register a
      // callback that with complete any establishWithLoginMethod call that is in
      // progress.
      Accounts.onPageLoadLogin((attemptInfo) => {
        var ai = attemptInfo;
        if (ai && ai.error &&
            ai.error.error === thisIdentityImpl.IDENTITY_ESTABLISHED &&
            thisIdentityImpl._isEstablishing) {
          thisIdentityImpl._completeEstablishing(err);
        }
      });
    }
  }
    
  // Information related to the most recent create/authentication call.
  get _invocation() {
    return this._ctx.get('invocation');
  }
  set _invocation(val) {
    this._ctx.set('invocation', val);
  }
  
  // Whether an establishWithLoginMethod call is in progress
  get _isEstablishing() {
    return this._ctx.get('isEstablishing');
  }
  set _isEstablishing(val) {
    if (val !== this._isEstablishing) {
      Meteor.call('Identity._setEstablishing',
        val,
        (error) => {
          if (error) {
            console.log(`Error calling Identity._setEstablishing: ${error}`);            
          }
        });
    }
    this._ctx.set('isEstablishing', val);
  }
  
  registerService(service) {
    check(service, Match.ObjectIncluding({
      authenticate: Function,
      create: Match.Optional(Function),
    }));
    return super.registerService(service);
  }
  
  create(serviceName, options) {
    check(serviceName, String);
    check(options, Object);
    let svc = this._getServiceByName(serviceName);
    if (! svc.create) {
      return false;
    }
    this._invocation = {
      serviceName: serviceName,
      methodName: 'create',
      clientState: options.clientState
    };
    return svc.create.apply(undefined, _.rest(arguments));
  }

  authenticate(serviceName, options) {
    check(serviceName, String);
    check(options, Object);
    let svc = this._getServiceByName(serviceName);
    this._invocation = {
      serviceName: serviceName,
      methodName: 'authenticate',
      clientState: options.clientState
    };
    return svc.authenticate.apply(undefined, _.rest(arguments));
  }
  
  onAttemptCompletion(callback) {
    check(callback, Function);
    this._completionHook.register(callback);
  }
  
  fireAttemptCompletion(error, result) {
    check(error, Match.OneOf(undefined, Error));
    if (! error) {
      check(result.identity, Match.ObjectIncluding({ serviceName: String }));      
    }
    var thisIdentityImpl = this;
    result = _.defaults(_.clone(result), 
      _.pick(thisIdentityImpl._invocation, 'methodName', 'clientState'));
    this._completionHook.each( (cb) => {
      cb.call(undefined, 
        error, result);
      return true;
    });
  }

  _getServiceByName(serviceName) {
    check(serviceName, String);
    let svc = this._services[serviceName];
    if (! svc) {
      throw new Error(this.SERVICE_NOT_FOUND, serviceName);
    }
    return svc;
  }
  
  establishWithLoginMethod(loginMethod /*, [arg0], ..., [callback] */) {
    let args = _.rest(arguments);
    let callback;

    // Enable "establishng"
    this._isEstablishing = true;
    
    // Create/modify the callback to disable "establishing" and run
    // onAttemptCompletion handlers
    if (_.isFunction(_.last(args))) {
      callback = args.pop();
    }
    let thisIdentityImpl = this;
    callback = _.wrap(callback, function (origCallback, err /*, result*/) {
      if (! err) {
        // This should never happen.
        throw new Error(`${loginMethod.name} failed to return an error`);
      }
      thisIdentityImpl._completeEstablishing(err, origCallback);
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
    Meteor.call('Identity._getIdentity', (err, identity) => {
      var result = this._invocation;
      result.identity = identity;
      this.fireAttemptCompletion(undefined, result);
      if (callback) {
        callback.call(undefined, undefined, result);
      }
    });
  }
}

Identity = new IdentityImpl();
