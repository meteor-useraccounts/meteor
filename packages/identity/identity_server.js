/* jshint esnext: true */

class IdentityServerImpl extends IdentityCommonImpl {
  constructor() {
    super();
  }
  
  registerService(service) {
    check(service, Match.ObjectIncluding({
      verify: Function,
    }));
    return super.registerService(service);
  }
  
  verify(identity) {
    check(identity, Match.ObjectIncluding({
      serviceName: String
    }));
    return this._getServiceByName(identity.serviceName).verify(identity);
  }
}

Identity = new IdentityServerImpl();
