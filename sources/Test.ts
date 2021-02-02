export interface Envelop {
  data: any;
}

export interface Testable {
  runTests?: () => Promise<void>;
}