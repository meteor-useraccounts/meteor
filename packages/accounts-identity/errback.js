/* globals Errback: true */

// Utility functions for bridging between code which uses the errback-style and
// code which uses promises or async/await-style. An errback is a function with
// the signature `function errback(error, result)`. Errback-style code takes the
class ErrbackImpl {
  // Converts a function which expects an errback into a `Promise`. `func` is
  // called with an errback that fulfills/rejects the promise. `func` should
  // pass the errback to a function which expects an errback. Usage example:
  // `result = await Errback.promise(eb => obj.asyncMethod(arg, eb));`
  //
  // Or equivalently:
  // `result = await Errback.promise(obj.asyncMethod.bind(obj, arg));`
  promise(func) {
    return new Promise((resolve, reject) => {
      func.call(undefined, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  // Converts an errback function into a pair of functions that handle the
  // settlement of a `Promise`. Usage: `p.then(...Errback.settlers(errback))`
  //
  // This is useful when implementing an errback-style function when using
  // promises.
  settlers(errback) {
    return [
      result => errback(undefined, result),
      error => errback(error)
    ];
  }
}

Errback = new ErrbackImpl();
