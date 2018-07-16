const randcolors = [ 'bold', 'red', 'green', 'blue', 'cyan', 'magenta', 'yellow', 'grey'
                   , 'bgBlack', 'bgRed', 'bgGreen', 'bgBlue', 'bgMagenta', 'bgYellow', 'bgCyan'
                   ];
const colors = require('colors');
const Fx = require('../dist/Fx.js').Fx;
let i1 = 0;
const c = str => {
  str = colors[randcolors[i1]](str);
  return str;
}
const cc = () => {
  i1 += 1;
}

const r = () => (Math.random() * 100) | 0;

class P {
  constructor(name) {
    this.name = name;
    this.flag = setTimeout(function () { console.log('') }, 100000000);
    console.log('> Starting', name);
  }
  stop() {
    console.log('< Stopping', name);
    clearTimeout(this.flag);
  }
}

function mkMs(name, mk) {
  return (parent, fx) => new Promise(resolve => {
    console.log('>> Producing ' + name);
    return setTimeout(() => {
      console.log('<< ' + name + ' Produced');
      resolve(mk(name));
    }, r());
  });
}
function mkFx(name) { return new Fx(mkAs(name)); }
function mkAs(name) { return mkMs(name, name => new P(name)); }



const M  = mkFx('M').open();

const S  = mkFx('S');
const St = S.pipe(mkAs('St')).open();

const C  = mkFx('C');
const Ch = C.pipe(mkAs('Ch'));

const L1 = St.merge(mkMs('L1', name => Ch.pipe(mkAs(name + 'Cs')).open()));
const L2 = St.merge(mkMs('L2', name => Ch.pipe(mkAs(name + 'Cs')).open()));

const M1 = M.merge(mkMs('M1', name => L1));
const M2 = M.merge(mkMs('M2', name => L2));


setTimeout(() => {
  M.failWith('1');
}, 1000)