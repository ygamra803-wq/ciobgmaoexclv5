export class Container {
  static instance = null;
  static bindings = new Map();

  static getInstance() {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  /**
   * Register binding
   */
  static register(key, factory, singleton = true) {
    const factoryFn = typeof factory === 'function' ? factory : () => factory;
    Container.bindings.set(key, {
      factory: factoryFn,
      singleton,
      instance: null
    });
  }

  /**
   * Resolve dependency
   */
  static resolve(key) {
    const binding = Container.bindings.get(key);

    if (!binding) {
      throw new Error(`Binding not found: ${key}`);
    }

    if (binding.singleton && binding.instance) {
      return binding.instance;
    }

    const instance = binding.factory();

    if (binding.singleton) {
      binding.instance = instance;
    }

    return instance;
  }
}
