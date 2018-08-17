"use strict";
exports.__esModule = true;
var util_1 = require("util");
var colors = require('colors/safe');
var globalOptions = new Map();
var Logger = /** @class */ (function () {
    function Logger(name, color) {
        if (color === void 0) { color = 'reset'; }
        this.name = name;
        this.color = color;
        this.withColor = globalOptions.has('withColor') ? globalOptions.get('withColor')
            : process.stdin.isTTY || process.stdout.isTTY || process.stderr.isTTY;
    }
    Logger.setOption = function (key, data) {
        globalOptions.set(key, data);
    };
    Logger.prototype["debugger"] = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var message = colors.bgBlue(this._headers('DEBUGGER', 'bold') + ' ' + this._format(args));
        this._write('debug', message);
        debugger;
    };
    Logger.prototype.todo = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var message = this._headers('TODO', 'bold', 'white') + ' ' + this._format(args);
        this._write('debug', message);
    };
    Logger.prototype.debug = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var message = this._headers('DBG', 'blue') + ' ' + this._format(args);
        this._write('debug', message);
    };
    Logger.prototype.stats = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var message = this._headers('STA', 'magenta') + ' ' + this._format(args);
        this._write('stats', message);
    };
    Logger.prototype.log = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var message = this._headers('LOG', 'green') + ' ' + this._format(args);
        this._write('log', message);
    };
    Logger.prototype.warn = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var message = this._headers('WRN', 'yellow') + ' ' + this._format(args);
        this._write('warning', message);
    };
    Logger.prototype.alert = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var message = this._headers('WRN', 'bold', 'yellow') + ' ' + this._format(args);
        this._write('alert', message);
        this._alert(message);
    };
    Logger.prototype.error = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var e = args[0];
        var error = (args.length == 1 && e instanceof Error) ? e.stack
            : (args.length == 1 && typeof e == 'string') ? e
                : (args.length == 1 && e && e.message) ? e.message
                    : this._format(args);
        var message = this._headers('ERR', 'red') + ' ' + error;
        this._write('error', message);
    };
    // ------
    Logger.prototype._write = function (type, message) {
        switch (type) {
            default: return process.stdout.write(message + '\n');
            case 'warning':
            case 'alert':
            case 'error': return process.stderr.write(message + '\n');
        }
    };
    Logger.prototype._alert = function (message) {
        var stack = new Error().stack;
        var origin = stack.split('\n')[3];
        var now = Date.now();
        var frequency = ((globalOptions.get('alertFrequency') | 0) || 60) * 1000;
        if (this.alerts[origin] == null)
            this.alerts[origin] = { last: now, times: 0 };
        var info = this.alerts[origin];
        if (info.last + frequency < now) {
            info.last = now, info.times = 0;
        }
        //
    };
    Logger.prototype._headers = function (tagName) {
        var modifiers = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            modifiers[_i - 1] = arguments[_i];
        }
        var name = this.withColor ? colors[String(this.color)](String(this.name)) : String(this.name);
        return this._tag(tagName, modifiers) + ' ' + this._date() + ' ' + name;
    };
    Logger.prototype._tag = function (name, modifiers) {
        if (this.withColor) {
            for (var i = 0; i < modifiers.length; i += 1)
                name = colors[modifiers[i]](name);
            return name;
        }
        else {
            return name;
        }
    };
    Logger.prototype._date = function () {
        var date = new Date();
        var Y = date.getFullYear();
        var M = this._datePad(date.getMonth() + 1);
        var D = this._datePad(date.getDate());
        var h = this._datePad(date.getHours());
        var m = this._datePad(date.getMinutes());
        var s = this._datePad(date.getSeconds());
        return [Y, '-', M, '-', D, ' ', h, ':', m, ':', s].join('');
    };
    Logger.prototype._datePad = function (number) {
        return number < 10 ? '0' + number : '' + number;
    };
    Logger.prototype._format = function (args) {
        if (typeof args[0] == 'string') {
            return this._sprintf(args[0], Array.prototype.slice.call(args, 1));
        }
        else {
            return Array.prototype.slice.call(args).map(function (arg) {
                var type = typeof arg;
                if (type == 'string')
                    return arg;
                return util_1.inspect(arg);
            }).join(' ');
        }
    };
    Logger.prototype._sprintf = function (pattern, args) {
        return pattern
            .replace(/%(blue|red|green|yellow|cyan|magenta|grey|bold|s|j|J)/g, function (_, fmt) {
            switch (fmt) {
                case 's':
                    {
                        var arg = args.shift();
                        if (typeof arg == 'string')
                            return arg;
                        return util_1.inspect(arg);
                    }
                    break;
                case 'j':
                case 'J':
                    {
                        var arg = args.shift();
                        var str = JSON.stringify(arg, function (key, value) {
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
            .replace(/$/, function () {
            if (args.length == 0)
                return '';
            return ' ' + args.map(function (item) { return util_1.inspect(item); }).join(', ');
        });
    };
    return Logger;
}());
exports["default"] = Logger;
