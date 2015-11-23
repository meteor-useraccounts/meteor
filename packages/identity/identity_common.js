/* jshint esnext: true */

IdentityCommonImpl = class IdentityCommonImpl {
  constructor() {
    // Service objects by service name
    this._services = {};
  }
  
  registerService(service) {
    check(service, Match.ObjectIncluding({
      name: String,
    }));
    if (this._services[service.name]) {
      throw new Error(this.SERVICE_ALREADY_REGISTERED, service.name);
    }
    this._services[service.name] = service;
  }
  
  _getServiceByName(serviceName) {
    check(serviceName, String);
    let svc = this._services[serviceName];
    if (! svc) {
      throw new Error(this.SERVICE_NOT_FOUND, serviceName);
    }
    return svc;
  }
    
  // Error messages
  get SERVICE_ALREADY_REGISTERED() { 
    return 'identity-service-already-registered';
  }
  get SERVICE_NOT_FOUND() {
    return 'identity-service-not-found';
  }
  get VERIFICATION_FAILED() {
    return 'verification-failed';
  }  
};
