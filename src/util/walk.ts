export function walk(tree: any, iterator: (key: any, value: any) => any, key: any = null): any {
  switch (Object.prototype.toString.call(tree)) {
  case '[object Object]': {
    const record = {};
    for (const key in tree) {
      const result = walk(tree[key], iterator, key);
      record[key] = iterator(key, result);
    }
    return record;
  } break ;
  case '[object Arguments]': case '[object Array]': {
    const array = [];
    for (let i = 0; i < tree.length; i += 1) {
      const result = walk(tree[i], iterator, i);
      array.push(iterator(i, result));
    }
    return array;
  } break ;
  case '[object Map]': {
    const map = new Map();
    for (const [key, value] of tree) {
      const result = walk(value, iterator, key);
      map.set(key, iterator(key, result));
    }
    return map;
  } break ;
  case '[object Set]': {
    const set = new Set();
    let index = 0;
    for (const [value] of tree) {
      const result = walk(value, iterator, index);
      set.add(iterator(index, result));
      index += 1;
    }
    return set;
  } break ;
  default: {
    return iterator(key, tree)
  } break ;
  }
}
