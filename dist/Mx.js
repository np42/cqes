"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Mx;
(function (Mx) {
    function typeOf(data) {
        const type = typeName(data);
        if (type != 'Object')
            return { type, data };
        if ('$mx' in data)
            return { type: data.$mx, data: data.pattern };
        return { type, data };
    }
    Mx.typeOf = typeOf;
    function typeName(data) {
        const type = Object.prototype.toString.call(data);
        return type.substring(8, type.length - 1);
    }
    Mx.typeName = typeName;
    function actionName(pattern) {
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
    Mx.actionName = actionName;
    function match(pattern, payload) {
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
                const { type, data } = typeOf(pattern);
                switch (type) {
                    case 'String':
                    case 'Number':
                    case 'Boolean':
                        return payload == data;
                    case 'Array':
                    case 'Arguments':
                        if (typeName(payload) != 'Array')
                            return false;
                        if (data.length > payload.length)
                            return false;
                        for (let i = 0; i < data.length; i += 1)
                            if (!match(data[i], payload[i]))
                                return false;
                        return true;
                    case 'Object':
                        if (typeName(payload) != 'Object')
                            return false;
                        for (const key in data) {
                            if (!(key in payload))
                                return false;
                            if (!match(data[key], payload[key]))
                                return false;
                        }
                        return true;
                    default:
                        return false;
                }
            default:
                return false;
        }
    }
    Mx.match = match;
    ;
})(Mx = exports.Mx || (exports.Mx = {}));
//# sourceMappingURL=Mx.js.map