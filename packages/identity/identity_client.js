/* jshint esnext: true */

class IdentityImpl {
  constructor() {
    // Service objects by service name
    this._services = {};
    
    // Hook manging callbacks registered by onAttemptCompletion() and run by
    // fireAttemptCompletion()
    this._completionHook = new Hook({ bindEnvironment: false });
    
     // Information about the most recent call to authenticate() or create()
    this._invocation = undefined;
    
    // Error messages
    this.SERVICE_ALREADY_REGISTERED = 'identity service already registered';
    this.SERVICE_NOT_FOUND = 'identity service not found';
  }
    
  registerService(service) {
    check(service, {
      name: String,
      authenticate: Function,
      create: Match.Optional(Function),
    });
    if (this._services[service.name]) {
      throw new Error(this.SERVICE_ALREADY_REGISTERED, service.name);
    }
    this._services[service.name] = service;
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
      check(identity, Match.ObjectIncluding({ serviceName: String }));      
    }
    var thisIdentityImpl = this;
    this._completionHook.each( (cb) => {
      cb.call(undefined, 
        error, _.defaults(_.clone(result), thisIdentityImpl._invocation));
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
}

Identity = new IdentityImpl();
