export function isConstructor(fn: Function) {
  if (typeof fn !== 'function') return false;
  if (!fn.hasOwnProperty('prototype')) return false;
  return true;
}
