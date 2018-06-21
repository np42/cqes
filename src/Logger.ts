import { inspect, format } from 'util';
const colors = require('colors/safe');

export default class Logger {

  private name:  string;
  private color: string;

  constructor(name: any, color: string);
  constructor(name: string, color: string) {
    this.name = name;
    this.color = color || 'reset';
  }

  debugger(...args: Array<any>) {
    const message = colors.bgBlue(
      ['DBG'.bold, this._date(), colors[this.color](this.name)
      , this._format(args)
      , '>>>>>>>>>>>>>>>>>> DEBUG ME <<<<<<<<<<<<<<<<<<<'
      ].join(' ')
    );
    process.stdout.write(message + '\n');
    debugger;
  }

  debug(...args: Array<any>) {
    const message =
      [ colors.blue('DBG'), this._date(), colors[this.color](this.name)
      , this._format(args)
      ].join(' ');
    process.stdout.write(message + '\n');
  }

  stats(...args: Array<any>) {
    const message =
      [ colors.magenta('STA'), this._date(), colors[this.color](this.name)
      , this._format(args)
      ].join(' ');
    process.stdout.write(message + '\n');
  }

  log(...args: Array<any>) {
    const message =
      [ colors.green('LOG'), this._date(), colors[this.color](this.name)
      , this._format(args)
      ].join(' ');
    process.stdout.write(message + '\n');
  }

  warn(...args: Array<any>) {
    const message =
      [ colors.yellow('WRN'), this._date(), colors[this.color](this.name)
      , this._format(args)
      ].join(' ');
    process.stdout.write(message + '\n');
  }

  alert(...args: Array<any>) {
    const message =
      [ colors.yellow('WRN').bold, this._date(), colors[this.color](this.name)
      , this._format(args)
      ].join(' ');
    process.stdout.write(message + '\n');
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
    process.stdout.write(message + '\n');
  }

  todo(...args: Array<any>) {
    const message =
      [ colors.bgRed('TODO').white.bold, this._date(), colors[this.color](this.name)
      , this._format(args)
      ].join(' ');
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
      .replace(/%(blue|red|green|yellow|cyan|magenta|grey|s|j)/g, (_, fmt) => {
        switch (fmt) {
        case 's': {
          const arg = args.shift();
          if (typeof arg == 'string') return arg;
          return inspect(arg);
        } break ;
        case 'j': {
          const arg = args.shift();
          return JSON.stringify(arg, function (key: string, value: any) {
            if (this[key] instanceof Buffer) return '<Buffer>';
            return value;
          });
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
