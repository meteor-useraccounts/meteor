/* jshint esnext: true */

class IdentityImpl extends IdentityCommonImpl {
  constructor() {
    super();
    let self = this;
    // Hook manging callbacks registered by onAttemptCompletion() and run by
    // fireAttemptCompletion()
    self._completionHook = new Hook({ bindEnvironment: false });
    
    // A 'context' object that keeps track of the most recent
    // create/authenticate invocation.
    // This is a persistent ReactiveDict so that it will survive a hot code push
    // or redirect.
    // TODO: Allow each IdentityImpl to have it's own reactive dict.
    self._ctx = new ReactiveDict('identity_ctx');
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
    let self = this;
    let svc = self._getServiceByName(serviceName);
    if (! svc.create) {
      return false;
    }
    self._invocation = {
      serviceName: serviceName,
      methodName: 'create',
      clientState: options.clientState
    };
    return svc.create.apply(undefined, _.rest(arguments));
  }

  authenticate(serviceName, options) {
    check(serviceName, String);
    check(options, Object);
    let self = this;
    let svc = self._getServiceByName(serviceName);
    self._invocation = {
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
    var self = this;
    if (! error) {
      result = _.clone(result);
      if (self._invocation) {
        check(self._invocation, Object);
        result = _.defaults(result,
          _.pick(self._invocation, 'methodName', 'clientState'));
      }
      check(result, Match.ObjectIncluding({
        methodName: String,
        identity: Match.ObjectIncluding({ serviceName: String })
      }));
    } else {
      check(result, undefined);
    }
    
    // Clear the invocation which is now complete.
    self._invocation = undefined;
    
    // Call the handlers
    self._completionHook.each( (cb) => {
      cb.call(undefined, 
        error, result);
      return true;
    });
  }
}

Identity = new IdentityImpl();
