"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
const colors = require('colors/safe');
class Logger {
    constructor(name, color) {
        this.name = name;
        this.color = color || 'reset';
        this.stipColors = !(process.stdin.isTTY || process.stdout.isTTY || process.stderr.isTTY);
    }
    debugger(...args) {
        const message = colors.bgBlue([colors.bold('DBG'), this._date(), colors[this.color](this.name),
            this._format(args),
            '>>>>>>>>>>>>>>>>>> DEBUG ME <<<<<<<<<<<<<<<<<<<'
        ].join(' '));
        this._write('debugger', message);
        debugger;
    }
    debug(...args) {
        const message = [colors.blue('DBG'), this._date(), colors[this.color](this.name),
            this._format(args)
        ].join(' ');
        this._write('debug', message);
    }
    stats(...args) {
        const message = [colors.magenta('STA'), this._date(), colors[this.color](this.name),
            this._format(args)
        ].join(' ');
        this._write('stats', message);
    }
    log(...args) {
        const message = [colors.green('LOG'), this._date(), colors[this.color](this.name),
            this._format(args)
        ].join(' ');
        this._write('log', message);
    }
    warn(...args) {
        const message = [colors.yellow('WRN'), this._date(), colors[this.color](this.name),
            this._format(args)
        ].join(' ');
        this._write('warn', message);
    }
    alert(...args) {
        const message = [colors.bold(colors.yellow('WRN')), this._date(), colors[this.color](this.name),
            this._format(args)
        ].join(' ');
        this._write('alert', message);
    }
    error(...args) {
        const e = args[0];
        const error = (args.length == 1 && e instanceof Error) ? e.stack
            : (args.length == 1 && typeof e == 'string') ? e
                : (args.length == 1 && e && e.message) ? e.message
                    : this._format(args);
        const message = [colors.red('ERR'), this._date(), colors[this.color](this.name),
            error
        ].join(' ');
        this._write('error', message);
    }
    todo(...args) {
        const message = [colors.bold(colors.white(colors.bgRed('TODO'))), this._date(), colors[this.color](this.name),
            this._format(args)
        ].join(' ');
        this._write('todo', message);
    }
    _write(type, message) {
        if (this.stipColors)
            message = colors.reset(message);
        process.stdout.write(message + '\n');
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
}
exports.default = Logger;
//# sourceMappingURL=Logger.js.map