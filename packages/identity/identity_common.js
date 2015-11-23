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
    
  // Error messages
  get SERVICE_ALREADY_REGISTERED() { 
    return 'identity-service-already-registered';
  }
  get SERVICE_NOT_FOUND() {
    return 'identity-service-not-found';
  }
  get IDENTITY_ESTABLISHED() {
    return 'identity-established';
  }  
  get VERIFICATION_FAILED() {
    return 'verification-failed';
  }  
};
