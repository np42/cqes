import { recfold } from './recfold';

export function qsencode(data: Object) {
  if (!data || data.constructor !== Object) throw new Error('Must have an Object');
  const result = [];
  (function loop(key: any, data: any, accu: any) {
    const escapedKey = encodeURIComponent(key);
    const path = key === null ? '' : accu + (accu.length === 0 ? escapedKey : '[' + escapedKey + ']');
    switch (Object.prototype.toString.call(data)) {
    case '[object Null]': case '[object Number]': case '[object Boolean]': case '[object String]':
      result.push(path + '=' + encodeURIComponent(data));
      return accu;
    case '[object Object]':
      for (const key in data) loop(key, data[key], path);
      return accu;
    case '[object Set]': case '[object Array]': case '[object Map]':
      let index = 0;
      for (const value of data) loop(index++, value, path);
      return accu;
    default:
      return accu;
    }
  })(null, data, '');
  return result.join('&');
}
