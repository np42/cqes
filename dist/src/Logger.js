"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
const colors = require('colors/safe');
const globalOptions = new Map();
class Logger {
    static setOption(key, data) {
        globalOptions.set(key, data);
    }
    constructor(name, color = 'reset') {
        this.name = name;
        this.color = color;
        this.withColor = globalOptions.has('withColor') ? globalOptions.get('withColor')
            : process.stdin.isTTY || process.stdout.isTTY || process.stderr.isTTY;
    }
    debugger(...args) {
        const header = colors.bgBlue(this._headers('DEBUGGER', 'bold'));
        const message = this._format(args);
        this._write(2, header, message);
        debugger;
    }
    todo(...args) {
        const header = this._headers('TODO', 'bold', 'white');
        const message = this._format(args);
        this._write(2, header, message);
    }
    debug(...args) {
        const header = this._headers('DBG', 'blue');
        const message = this._format(args);
        this._write(2, header, message);
    }
    stats(...args) {
        const header = this._headers('STA', 'magenta');
        const message = this._format(args);
        this._write(1, header, message);
    }
    log(...args) {
        const header = this._headers('LOG', 'green');
        const message = this._format(args);
        this._write(1, header, message);
    }
    warn(...args) {
        const header = this._headers('WRN', 'yellow');
        const message = this._format(args);
        this._write(2, header, message);
    }
    alert(...args) {
        const header = this._headers('WRN', 'bold', 'yellow');
        const message = this._format(args);
        this._write(2, header, message);
        this._alert(message);
    }
    error(...args) {
        const header = this._headers('ERR', 'red');
        const e = args[0];
        const message = (args.length == 1 && e instanceof Error) ? e.stack
            : (args.length == 1 && typeof e == 'string') ? e
                : (args.length == 1 && e && e.message) ? e.message
                    : this._format(args);
        this._write(2, header, message);
    }
    _write(std, header, message) {
        const log = message.split('\n').map(line => header + ' ' + line + '\n').join('');
        switch (std) {
            case 1: return process.stdout.write(log);
            default:
            case 2: return process.stderr.write(log);
        }
    }
    _alert(message) {
        const stack = new Error().stack;
        const origin = stack.split('\n')[3];
        const now = Date.now();
        const frequency = ((globalOptions.get('alertFrequency') | 0) || 60) * 1000;
        if (this.alerts[origin] == null)
            this.alerts[origin] = { last: now, times: 0 };
        const info = this.alerts[origin];
        if (info.last + frequency < now) {
            info.last = now, info.times = 0;
        }
    }
    _headers(tagName, ...modifiers) {
        const name = this.withColor ? colors[String(this.color)](String(this.name)) : String(this.name);
        return this._tag(tagName, modifiers) + ' ' + this._date() + ' ' + name;
    }
    _tag(name, modifiers) {
        if (this.withColor) {
            for (let i = 0; i < modifiers.length; i += 1)
                name = colors[modifiers[i]](name);
            return name;
        }
        else {
            return name;
        }
    }
    _date() {
        const date = new Date();
        const Y = date.getFullYear();
        const M = this._datePad(date.getMonth() + 1);
        const D = this._datePad(date.getDate());
        const h = this._datePad(date.getHours());
        const m = this._datePad(date.getMinutes());
        const s = this._datePad(date.getSeconds());
        return [Y, '-', M, '-', D, ' ', h, ':', m, ':', s].join('');
    }
    _datePad(number) {
        return number < 10 ? '0' + number : '' + number;
    }
    _format(args) {
        if (typeof args[0] == 'string') {
            return this._sprintf(args[0], Array.prototype.slice.call(args, 1));
        }
        else {
            return Array.prototype.slice.call(args).map((arg) => {
                const type = typeof arg;
                if (type == 'string')
                    return arg;
                return util_1.inspect(arg);
            }).join(' ');
        }
    }
    _sprintf(pattern, args) {
        return pattern
            .replace(/%(blue|red|green|yellow|cyan|magenta|grey|bold|s|j|J)/g, (_, fmt) => {
            switch (fmt) {
                case 's':
                    {
                        const arg = args.shift();
                        if (typeof arg == 'string')
                            return arg;
                        return util_1.inspect(arg);
                    }
                    break;
                case 'j':
                case 'J':
                    {
                        const arg = args.shift();
                        const str = JSON.stringify(arg, function (key, value) {
                            if (this[key] instanceof Buffer)
                                return '<Buffer>';
                            if (typeof value == 'string' && value.length > 256)
                                return [value.substr(0, 200),
                                    '<... ' + (value.length - 220) + ' chars ...>',
                                    value.substr(value.length - 20)
                                ].join('');
                            return value;
                        });
                        return fmt == 'j' ? colors.grey(str) : str;
                    }
                    break;
                default:
                    {
                        return colors[fmt](args.shift());
                    }
                    break;
            }
        })
            .replace(/$/, () => {
            if (args.length == 0)
                return '';
            return ' ' + args.map(item => util_1.inspect(item)).join(', ');
        });
    }
}
exports.Logger = Logger;
//# sourceMappingURL=Logger.js.map