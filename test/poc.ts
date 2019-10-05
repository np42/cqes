class A {
  public static _a = 42;
  public static a<T extends new (...a: any[]) => A>(this: T) {
    this._a;
    return class extends this {};
  }
  public static b<T extends new (...a: any[]) => A>(this: T) {
    return class extends this {};
  }
  public static c() {
    return 0;
  }
}

class B extends A {
  public static _a = 7;
  public static _b = 6;
  public static b<T extends new (...a: any[]) => B>(this: T) {
    return class extends this {};
  }
  public static c() {
    return 1;
  }
}

class C extends B {
  public static c() {
    return this._a * this._b;
  }
}

console.log(C.a()._a);
console.log(C.a().b().c());
