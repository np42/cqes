import { inspect, format } from 'util';
const colors = require('colors/safe');

export default class Logger {

  private name:       string;
  private color:      string;
  private stipColors: boolean;

  constructor(name: any, color: string);
  constructor(name: string, color: string) {
    this.name       = name;
    this.color      = color || 'reset';
    this.stipColors = !(process.stdin.isTTY || process.stdout.isTTY || process.stderr.isTTY);
  }

  debugger(...args: Array<any>) {
    const message = colors.bgBlue(
      [ colors.bold('DBG'), this._date(), colors[this.color](this.name)
      , this._format(args)
      , '>>>>>>>>>>>>>>>>>> DEBUG ME <<<<<<<<<<<<<<<<<<<'
      ].join(' ')
    );
    this._write('debugger', message);
    debugger;
  }

  debug(...args: Array<any>) {
    const message =
      [ colors.blue('DBG'), this._date(), colors[this.color](this.name)
      , this._format(args)
      ].join(' ');
    this._write('debug', message);
  }

  stats(...args: Array<any>) {
    const message =
      [ colors.magenta('STA'), this._date(), colors[this.color](this.name)
      , this._format(args)
      ].join(' ');
    this._write('stats', message);
  }

  log(...args: Array<any>) {
    const message =
      [ colors.green('LOG'), this._date(), colors[this.color](this.name)
      , this._format(args)
      ].join(' ');
    this._write('log', message);
  }

  warn(...args: Array<any>) {
    const message =
      [ colors.yellow('WRN'), this._date(), colors[this.color](this.name)
      , this._format(args)
      ].join(' ');
    this._write('warn', message);
  }

  alert(...args: Array<any>) {
    const message =
      [ colors.bold(colors.yellow('WRN')), this._date(), colors[this.color](this.name)
      , this._format(args)
      ].join(' ');
    this._write('alert', message);
  }

  error(...args: Array<any>) {
    const e = args[0];
    const error = (args.length == 1 && e instanceof Error) ? e.stack
      : (args.length == 1 && typeof e == 'string') ? e
      : (args.length == 1 && e && e.message) ? e.message
      : this._format(args);
    const message =
      [ colors.red('ERR'), this._date(), colors[this.color](this.name)
      , error
      ].join(' ');
    this._write('error', message);
  }

  todo(...args: Array<any>) {
    const message =
      [ colors.bold(colors.white(colors.bgRed('TODO'))), this._date(), colors[this.color](this.name)
      , this._format(args)
      ].join(' ');
    this._write('todo', message);
  }

  // ------

  _write(type: string, message: string) {
    if (this.stipColors) message = colors.reset(message);
    process.stdout.write(message + '\n');
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

}
