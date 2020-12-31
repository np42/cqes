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
let stopped = false
const s = (name, str) => {
  const v = { toString: () => str
            , timer: setInterval(() => {
                if (!stopped) return ;
                console.log('Test Failed', name, 'still alive');
                v.stop();
              }, 1000)
            , stop: () => {
                if (v.timer == null) {
                  console.log(name, 'already stopped');
                } else {
                  clearInterval(v.timer);
                  v.timer = null;
                  console.log('stoping', name);
                }
              }
            };
  return v;
};

let fxA1 = null;
setTimeout(() => { cc(); fxA1.failWith('error on A1') }, 18000);
const A1 = new Fx((_, fx) => new Promise(resolve => {
  fxA1 = fx;
  console.log('Produce A1');
  const res = s('A1', c('A1'));
  fx.one('disrupted', res.stop);
  setTimeout(() => resolve(res), 100);
}));

let fxA2 = null;
setTimeout(() => { cc(); fxA2.failWith('error on A2') }, 6000);
const A2 = A1.pipe((a1, fx) => new Promise(resolve => {
  console.log('Produce A2');
  fxA2 = fx;
  const res = s('A2', a1 + ' ' + c('A2'));
  fx.one('disrupted', res.stop);
  setTimeout(() => resolve(res), 100);
}));

let fxA3 = null;
setTimeout(() => { cc(); fxA3.failWith('error on A3') }, 9000);
const A3 = A2.pipe((a2, fx) => new Promise(resolve => {
  console.log('Produce A3');
  fxA3 = fx;
  const res = s('A3', a2 + ' ' + c('A3'));
  fx.one('disrupted', res.stop);
  setTimeout(() => resolve(res), 100);
}));

const B1 = new Fx((_, fx) => new Promise(resolve => {
  console.log('Produce B1');
  const res = s('B1', c('B1'));
  fx.one('disrupted', res.stop);
  setTimeout(() => resolve(c('B1')), 60)
}));

let fxB2 = null;
setTimeout(() => { cc(); fxB2.failWith('error on B2') }, 3000);
const B2 = B1.pipe((b1, fx) => new Promise(resolve => {
  console.log('Produce B2');
  fxB2 = fx;
  const res = s('B2', b1 + ' ' + c('B2'));
  fx.one('disrupted', res.stop);
  setTimeout(() => resolve(res), 60);
}));

const B3 = B2.pipe((b2, fx) => new Promise(resolve => {
  console.log('Produce B3');
  const res = s('B3', b2 + ' ' + c('B3'));
  fx.on('disrupted', res.stop);
  setTimeout(() => resolve(res), 60);
}));

let fxAB3x = null;
setTimeout(() => { cc(); fxAB3x.failWith('error on AB3*') }, 21000);
const AB3 = A3.merge(async (a3, fx) => {
  console.log('Produce AB3');
  return B3.pipe((b3, fxx) => new Promise(resolve => {
    console.log('Produce AB3*');
    debugger;
    const res = s('AB3*', a3 + ' ' + b3 + ' ' + c('AB3'));
    fxAB3x = fxx;
    fx.one('disrupted', res.stop);
    setTimeout(() => resolve(res), 10);
  }));
});

let fxAB3C = null;
setTimeout(() => { cc(); fxAB3C.failWith('error on AB3C') }, 15000);
const AB3C = AB3.pipe((ab3, fx) => new Promise(resolve => {
  console.log('Produce AB3C');
  fxAB3C = fx;
  const res = s('AB3C', ab3 + ' ' + c('C'));
  fx.one('disrupted', res.stop);
  setTimeout(() => resolve(res), 150);
}));

let count = 0;
(async function self() {
  //debugger;
  const value = await AB3C.get();
  console.log('>    ' + value);
  if (++count == 25) { stopped = true; return A1.abort(); }
  return setTimeout(self, 1000);
})();

global.A = A1;