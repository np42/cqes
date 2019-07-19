function clone<T>(item: T): T {
  switch (Object.prototype.toString.call(item)) {
  case '[object Object]': return cloneObject(item);
  case '[object Array]':  return <any>cloneArray(<any>item);
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

function cloneArray<T>(item: Array<any>): Array<T> {
  return <Array<any>>item.map(clone);
}

function cloneRegExp(item: RegExp): RegExp {
  return new RegExp(item.source, item.flags);
}

function cloneDate(item: Date) {
  return new Date(item.getTime());
}

export { clone };
