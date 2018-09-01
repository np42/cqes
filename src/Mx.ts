export namespace Mx {

  export type Rule = (payload: any, options?: any) => boolean;

  export const rules = <Map<string, Rule>>new Map();

  rules.set('not-empty-string', payload => {
    if (typeof payload != 'string') return false;
    if (payload == '') return false;
    return true;
  });

  export function typeOf(data: any) {
    const type = typeName(data);
    if (type != 'Object') return { type, data };
    if ('$mx' in data) return { type: data.$mx, data: data.pattern };
    return { type, data };
  }

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

  export function checkRule(rule: Rule | string, options: any, payload: any) {
    if (typeof rule == 'string') rule = rules.get(rule);
    if (rule == null) return false;
    return '';
  }

  export function match(pattern: any, payload: any) {
    switch (actionName(pattern)) {
    case 'IsNull':
      return payload == null;
    case 'Test':
      return pattern.test(payload);
    case 'Rule':
      const rule = rules.get(pattern.rule);
      if (rule == null) return false;
      return rule(payload, pattern.options);
    case 'OneOf':
      for (let i = 0; i < pattern.length; i += 1)
        if (match(pattern[i], payload))
          return true;
      return false;
    case 'Equiv':
      const { type, data } = typeOf(pattern);
      switch (type) {
      case 'String': case 'Number': case 'Boolean':
        return payload == data;
      case 'Array': case 'Arguments':
        if (typeName(payload) != 'Array') return false;
        if (data.length > payload.length) return false;
        for (let i = 0; i < data.length; i += 1)
          if (!match(data[i], payload[i]))
            return false;
        return true;
      case 'Object':
        if (typeName(payload) != 'Object') return false;
        for (const key in data) {
          if (!(key in payload)) return false;
          if (!match(data[key], payload[key])) return false;
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