import { inspect } from 'util';
const colors = require('colors/safe');

type optionName = 'withColor' | 'alertFrequency';

const globalOptions = <Map<optionName | string, any>>new Map();
const isTTY = process.stdin.isTTY || process.stdout.isTTY || process.stderr.isTTY;

export class Logger {

  static setOption(key: optionName | string, data: any) {
    globalOptions.set(key, data);
  }

  private name:       { toString: () => string };
  private withColor:  boolean;
  private alerts:     { [key: string]: { last: number, times: number } };

  constructor(pattern: string, ...args: Array<string>) {
    this.name       = this._sprintf(pattern, args);
    this.withColor  = globalOptions.has('withColor') ? globalOptions.get('withColor') : isTTY;
    //
    this.debugger   = this.debugger.bind(this);
    this.todo       = this.todo.bind(this);
    this.debug      = this.debug.bind(this);
    this.stats      = this.stats.bind(this);
    this.info       = this.info.bind(this);
    this.warn       = this.warn.bind(this);
    this.alert      = this.alert.bind(this);
    this.trace      = this.trace.bind(this);
    this.error      = this.error.bind(this);
  }

  debugger(...args: Array<any>) {
    const header  = colors.bgBlue(this._headers('DEBUGGER', 'bold'));
    const message = this._format(args);
    this._write(2, header, message);
    debugger;
  }

  todo(...args: Array<any>) {
    const header  = this._headers('TODO', 'bold', 'white');
    const message = this._format(args);
    this._write(2, header, message);
  }

  debug(...args: Array<any>) {
    if (!isTTY) return ;
    const header  = this._headers('DBG', 'blue');
    const message = this._format(args);
    this._write(2, header, message);
  }

  stats(...args: Array<any>) {
    const header  = this._headers('STA', 'magenta');
    const message = this._format(args);
    this._write(1, header, message);
  }

  info(...args: Array<any>) {
    const header  = this._headers('INF', 'grey');
    const message = this._format(args);
    this._write(1, header, message);
  }

  log(...args: Array<any>) {
    const header  = this._headers('LOG', 'green');
    const message = this._format(args);
    this._write(1, header, message);
  }

  warn(...args: Array<any>) {
    const header  = this._headers('WRN', 'yellow');
    const message = this._format(args);
    this._write(2, header, message);
  }

  alert(...args: Array<any>) {
    const header  = this._headers('WRN', 'bold', 'yellow');
    const message = this._format(args);
    this._write(2, header, message);
    this._alert(message);
  }

  trace(...args: Array<any>) {
    const header  = this._headers('WRN', 'bold', 'yellow');
    const message = this._format(args);
    const stack   = new Error().stack.split('\n').slice(2).join('\n')
    this._write(2, header, message + '\n' + stack);
  }

  error(...args: Array<any>) {
    const header = this._headers('ERR', 'red');
    const e      = args[0];
    const message = (args.length == 1 && e instanceof Error) ? e.stack
      : (args.length == 1 && typeof e == 'string') ? e
      : (args.length == 1 && e && e.message) ? e.message
      : this._format(args);
    this._write(2, header, message);
  }

  fatal(...args: Array<any>) {
    this.error(...args);
    process.exit(-1);
  }

  // ------

  _write(std: number, header: string, message: string) {
    const log = message.split('\n').map(line => header + ' ' + line + '\n').join('');
    if (std === 1 || !isTTY) process.stdout.write(log);
    if (std === 2) process.stderr.write(log);
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
    return this._date() + ' ' + this._tag(tagName, modifiers) + ' ' + String(this.name);
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
    const tzo  = -date.getTimezoneOffset();
    const diff = tzo >= 0 ? '+' : '-';
    return date.getFullYear() +
      '-'  + String(date.getMonth() + 1).padStart(2, '0') +
      '-'  + String(date.getDate()).padStart(2, '0') +
      'T'  + String(date.getHours()).padStart(2, '0') +
      ':'  + String(date.getMinutes()).padStart(2, '0') +
      ':'  + String(date.getSeconds()).padStart(2, '0') +
      '.'  + String(date.getMilliseconds()).padStart(2, '0') +
      diff + String(tzo / 60).padStart(2, '0') +
      ':'  + String(tzo % 60).padStart(2, '0');
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
      .replace(/%(\d*[cwl][\.!])?(s|e|blue|red|green|yellow|cyan|magenta|grey|bold)/g, (_, strip, fmt) => {
        switch (fmt) {
        case 's': {
          const arg = args.shift();
          if (typeof arg === 'string')
            return this._strip(strip, arg, s => s);
          if (arg instanceof Error) {
            const message = String(arg);
            return this._strip(strip, message.substring(message.indexOf(' ') + 1), s => s);
          }
          return this._strip(strip, inspect(arg, { compact: true }), s => s);
        } break ;
        case 'e': {
          const arg = args.shift();
          if (arg instanceof Error) return this._strip(strip, arg.stack, s => s);
          return this._strip(strip, inspect(arg), s => s);
        } break ;
        default: {
          return this._strip(strip, args.shift(), colors[fmt]);
        } break ;
        }
      })
      .replace(/$/, () => {
        if (args.length == 0) return '';
        return ' ' + args.map(item => inspect(item)).join(', ');
      });
  }

  _strip(format: string, data: string, modifier: (data: string) => string) {
    if (format == null) return modifier(data);
    const keepEnd = format[format.length - 1] === '.';
    let count = parseInt(format, 10) || 1;
    for (const char of format) {
      switch (char) {
      case 'c': {
        return modifier(data.slice(0, count)) + (keepEnd ? data.slice(count) : '');
      } break ;
      case 'w': case 'l': {
        const rxp = char === 'w' ? /\s*[^\s]+/g : /(\r?\n)*[^\n]+/g;
        let offset = 0;
        let match = null;
        do {
          match = rxp.exec(data);
          if (match) offset = match.index + match[0].length;
          count -= 1;
        } while (match && count > 0);
        return modifier(data.slice(0, offset)) + (keepEnd ? data.slice(offset) : '');
      } break ;
      }
    }
  }

}
