function clone<T>(item: T): T {
  switch (Object.prototype.toString.call(item)) {
  case '[object Object]': return cloneObject(item);
  case '[object Set]':    return <any>cloneSet(<any>item);
  case '[object Array]':  return <any>cloneArray(<any>item);
  case '[object Map]':    return <any>cloneMap(<any>item);
  case '[object Regexp]': return <any>cloneRegExp(<any>item);
  case '[object Date]':   return <any>cloneDate(<any>item);
  default: return item;
  }
}

function cloneObject<T>(item: T) {
  const result = <any>{};
  for (const key in item)
    result[key] = clone(<any>item[key]);
  return result;
}

function cloneSet<T>(item: Set<any>): Set<T> {
  const set = new Set();
  for (const entry of item) set.add(clone(entry));
  return set;
}

function cloneArray<T>(item: Array<any>): Array<T> {
  return <Array<any>>item.map(clone);
}

function cloneMap<K, V>(item: Map<any, any>): Map<K, V> {
  const map = new Map();
  for (const [key, value] of item) map.set(clone(key), clone(value));
  return map;
}

function cloneRegExp(item: RegExp): RegExp {
  return new RegExp(item.source, item.flags);
}

function cloneDate(item: Date) {
  return new Date(item.getTime());
}

export { clone };
