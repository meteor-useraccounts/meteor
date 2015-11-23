/* jshint esnext: true */

class IdentityImpl extends IdentityCommonImpl {
  constructor() {
    super();
    
    // Hook manging callbacks registered by onAttemptCompletion() and run by
    // fireAttemptCompletion()
    this._completionHook = new Hook({ bindEnvironment: false });
    
    // A 'context' object that keeps track of the most recent
    // create/authenticate invocation.
    // This is a persistent ReactiveDict so that it will survive a hot code push
    // or redirect.
    // TODO: Allow each IdentityImpl to have it's own reactive dict.
    this._ctx = new ReactiveDict('identity_ctx');
    
    let thisIdentityImpl = this;
  }
    
  // Information related to the most recent create/authentication call.
  get _invocation() {
    return this._ctx.get('invocation');
  }
  set _invocation(val) {
    this._ctx.set('invocation', val);
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
    return this._completionHook.register(callback);
  }
  
  fireAttemptCompletion(error, result) {
    check(error, Match.OneOf(undefined, Error));
    var thisIdentityImpl = this;
    if (! error) {
      result = _.clone(result);
      if (thisIdentityImpl._invocation) {
        check(thisIdentityImpl._invocation, Object);
        result = _.defaults(result,
          _.pick(thisIdentityImpl._invocation, 'methodName', 'clientState'));
      }
      check(result, Match.ObjectIncluding({
        methodName: String,
        identity: Match.ObjectIncluding({ serviceName: String })
      }));
    } else {
      check(result, undefined);
    }
    
    // Clear the invocation which is now complete.
    thisIdentityImpl._invocation = undefined;
    
    // Call the handlers
    this._completionHook.each( (cb) => {
      cb.call(undefined, 
        error, result);
      return true;
    });
  }
}

Identity = new IdentityImpl();
