export namespace Mx {

  export function typeName(data: any) {
    const type = Object.prototype.toString.call(data);
    return type.substring(8, type.length - 1);
  }

  export function actionName(pattern: any) {
    if (pattern == null)
      return 'IsNull';
    const type = typeName(pattern);
    if (type == 'Object' && '$mx' in pattern)
      return pattern.$mx;
    if (type == 'Array' && !(pattern.length == 1 && typeName(pattern[0]) == 'Array'))
      return 'OneOf';
    if (type == 'RegExp')
      return 'Test';
    return 'Equiv';
  }

  export function match(pattern: any, payload: any) {
    switch (actionName(pattern)) {
    case 'IsNull':
      return payload == null;
    case 'Test':
      return pattern.test(payload);
    case 'OneOf':
      for (let i = 0; i < pattern.length; i += 1)
        if (match(pattern[i], payload))
          return true;
      return false;
    case 'Equiv':
      switch (typeName(pattern.pattern)) {
      case 'String': case 'Number': case 'Boolean':
        return payload == pattern;
      case 'Array': case 'Arguments':
        if (typeName(payload) != 'Array') return false;
        if (pattern.pattern.length > payload.length) return false;
        for (let i = 0; i < pattern.pattern.length; i += 1)
          if (!match(pattern.pattern[i], payload[i]))
            return false;
        return true;
      case 'Object':
        if (typeName(payload) != 'Object') return false;
        for (const key in pattern) {
          if (!(key in payload)) return false;
          if (!match(pattern[key], payload[key])) return false;
        }
        return true;
      default:
        return false;
      }
    default:
      return false;
    }
  };

}