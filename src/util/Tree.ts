type reduceIterator = (accu: any, key: any, value: any, skip: () => void) => any;

export class Tree {

  static map(tree: any, iterator: (key: any, value: any) => any, key: any = null): any {
    switch (Object.prototype.toString.call(tree)) {
    case '[object Object]': {
      const record = {};
      for (const key in tree) {
        const result = Tree.map(tree[key], iterator, key);
        record[key] = iterator(key, result);
      }
      return record;
    } break ;
    case '[object Arguments]': case '[object Array]': {
      const array = [];
      for (let i = 0; i < tree.length; i += 1) {
        const result = Tree.map(tree[i], iterator, i);
        array.push(iterator(i, result));
      }
      return array;
    } break ;
    case '[object Map]': {
      const map = new Map();
      for (const [key, value] of tree) {
        const result = Tree.map(value, iterator, key);
        map.set(key, iterator(key, result));
      }
      return map;
    } break ;
    case '[object Set]': {
      const set = new Set();
      let index = 0;
      for (const [value] of tree) {
        const result = Tree.map(value, iterator, index);
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

  static reduce(tree: any, iterator: reduceIterator, accu: any, key: any = null) {
    let skip = false;
    accu = iterator(accu, key, tree, () => { skip = true });
    if (skip) return accu;
    switch (Object.prototype.toString.call(tree)) {
    case '[object Object]': {
      for (const key in tree)
        accu = Tree.reduce(tree[key], iterator, accu, key);
    } break ;
    case '[object Arguments]': case '[object Array]': {
      for (let i = 0; i < tree.length; i += 1)
        accu = Tree.reduce(tree[i], iterator, accu, i);
    } break ;
    case '[object Map]': {
      for (const [key, value] of tree)
        accu = Tree.reduce(value, iterator, accu, key);
    } break ;
    case '[object Set]': {
      let index = 0;
      for (const [value] of tree)
        accu = Tree.reduce(value, iterator, accu, index++);
    } break ;
    }
    return accu;
  }

  static replace(tree: any, iterator: (value: any, key: any) => any, key: any = null): any {
    const result = iterator(tree, key);
    switch (Object.prototype.toString.call(result)) {
    case '[object Object]': {
      for (const key in result)
        result[key] = Tree.replace(result[key], iterator, key);
    } break ;
    case '[object Arguments]': case '[object Array]': {
      for (let i = 0; i < result.length; i += 1)
        result[i] = Tree.replace(result[key], iterator, i);
    } break ;
    case '[object Map]': {
      for (const [key, value] of result)
        result.set(key, Tree.replace(value, iterator, key));
    } break ;
    case '[object Set]': {
      let index = 0;
      for (const [value] of result) {
        result.delete(value);
        result.add(Tree.replace(value, iterator, index));
        index += 1;
      }
    } break ;
    }
    return result;
  }

}