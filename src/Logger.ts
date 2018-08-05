import { inspect, format } from 'util';
const colors = require('colors/safe');

type optionName = 'withColor' | 'alertFrequency';

const globalOptions = <Map<optionName, any>>new Map();

export default class Logger {

  static setOption(key: optionName, data: any) {
    globalOptions.set(key, data);
  }

  private name:       { toString: () => string };
  private color:      string;
  private withColor:  boolean;
  private alerts:     { [key: string]: { last: number, times: number } };

  constructor(name: string | { toString: () => string }, color: string = 'reset') {
    this.name       = name;
    this.color      = color;
    this.withColor  = globalOptions.has('withColor') ? globalOptions.get('withColor')
      : process.stdin.isTTY || process.stdout.isTTY || process.stderr.isTTY;
  }

  debugger(...args: Array<any>) {
    const message = colors.bgBlue(this._headers('DEBUGGER', 'bold') + ' ' +  this._format(args));
    this._write('debug', message);
    debugger;
  }

  todo(...args: Array<any>) {
    const message = this._headers('TODO', 'bold', 'white') + ' ' + this._format(args);
    this._write('debug', message);
  }

  debug(...args: Array<any>) {
    const message = this._headers('DBG', 'blue') + ' ' + this._format(args);
    this._write('debug', message);
  }

  stats(...args: Array<any>) {
    const message = this._headers('STA', 'magenta') + ' ' + this._format(args);
    this._write('stats', message);
  }

  log(...args: Array<any>) {
    const message = this._headers('LOG', 'green') + ' ' + this._format(args);
    this._write('log', message);
  }

  warn(...args: Array<any>) {
    const message = this._headers('WRN', 'yellow') + ' ' + this._format(args);
    this._write('warning', message);
  }

  alert(...args: Array<any>) {
    const message = this._headers('WRN', 'bold', 'yellow') + ' ' + this._format(args);
    this._write('alert', message);
    this._alert(message);
  }

  error(...args: Array<any>) {
    const e = args[0];
    const error = (args.length == 1 && e instanceof Error) ? e.stack
      : (args.length == 1 && typeof e == 'string') ? e
      : (args.length == 1 && e && e.message) ? e.message
      : this._format(args);
    const message = this._headers('ERR', 'red') + ' ' + error;
    this._write('error', message);
  }

  // ------

  _write(type: string, message: string) {
    switch (type) {
    default: return process.stdout.write(message + '\n');
    case 'warning': case 'alert': case 'error': return process.stderr.write(message + '\n');
    }
  }

  _alert(message: string) {
    const stack     = new Error().stack;
    const origin    = stack.split('\n')[3];
    const now       = Date.now();
    const frequency = ((globalOptions.get('alertFrequency') | 0) || 60) * 1000;
    if (this.alerts[origin] == null) this.alerts[origin] = { last: now, times: 0 };
    const info = this.alerts[origin];
    if (info.last + frequency < now) { info.last = now, info.times = 0 }
    //
  }

  _headers(tagName: string, ...modifiers: Array<string>) {
    const name = this.withColor ? colors[String(this.color)](String(this.name)) : String(this.name);
    return this._tag(tagName, modifiers) + ' ' + this._date() + ' ' + name;
  }

  _tag(name: string, modifiers: Array<string>) {
    if (this.withColor) {
      for (let i = 0; i < modifiers.length; i += 1)
        name = colors[modifiers[i]](name);
      return name;
    } else {
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

  _datePad(number: number) {
    return number < 10 ? '0' + number : '' + number;
  }

  _format(args: any) {
    if (typeof args[0] == 'string') {
      return this._sprintf(args[0], Array.prototype.slice.call(args, 1));
    } else {
      return Array.prototype.slice.call(args).map((arg: any) => {
        const type = typeof arg;
        if (type == 'string') return arg;
        return inspect(arg);
      }).join(' ');
    }
  }

  _sprintf(pattern: string, args: Array<any>) {
    return pattern
      .replace(/%(blue|red|green|yellow|cyan|magenta|grey|bold|s|j|J)/g, (_, fmt) => {
        switch (fmt) {
        case 's': {
          const arg = args.shift();
          if (typeof arg == 'string') return arg;
          return inspect(arg);
        } break ;
        case 'j': case 'J': {
          const arg = args.shift();
          const str = JSON.stringify(arg, function (key: string, value: any) {
            if (this[key] instanceof Buffer) return '<Buffer>';
            return value;
          });
          return fmt == 'j' ? colors.grey(str) : str;
        } break ;
        default: {
          return colors[fmt](args.shift());
        } break ;
        }
      })
      .replace(/$/, () => {
        if (args.length == 0) return '';
        return ' ' + args.map(item => inspect(item)).join(', ');
      });
  }

}
