import clone from './clone';

function merge<S, T>(left: S, right: T): any {
  switch (typeof right) {
  case 'object':
    if (right === null) return null;
    if (right instanceof Array) return clone(right);
    if (Object.prototype.toString.call(right) !== '[object Object]') return clone(right);
    if (Object.prototype.toString.call(left) !== '[object Object]') return clone(right);
    return mergeObject(left, right);
  default:
    if (right === undefined) return clone(left);
    return right;
  }
}

function mergeObject<S, T>(left: S, right: T): T {
  // TODO: write better algo
  const result = clone(right);
  for (const key in <any>left) {
    if (result[key] === undefined)
      result[key] = clone(left[key]);
    else
      result[key] = merge(left[key], right[key]);
  }
  return result;
}

export default merge;
