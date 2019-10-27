type iterator = (accu: any, key: any, value: any, skip: () => void) => any;
export function recfold(tree: any, iterator: iterator, accu: any, key: any = null) {
  let skip = false;
  accu = iterator(accu, key, tree, () => { skip = true });
  if (skip) return accu;
  switch (Object.prototype.toString.call(tree)) {
  case '[object Object]': {
    for (const key in tree)
      accu = recfold(tree[key], iterator, accu, key);
  } break ;
  case '[object Arguments]': case '[object Array]': {
    for (let i = 0; i < tree.length; i += 1)
      accu = recfold(tree[i], iterator, accu, i);
  } break ;
  case '[object Map]': {
    for (const [key, value] of tree)
      accu = recfold(value, iterator, accu, key);
  } break ;
  case '[object Set]': {
    let index = 0;
    for (const [value] of tree)
      accu = recfold(value, iterator, accu, index++);
  } break ;
  }
  return accu;
}