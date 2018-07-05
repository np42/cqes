const randcolors = [ ['white', 'red', 'green', 'blue', 'cyan', 'magenta', 'yellow', 'grey', 'bold']
                   , ['bgBlack', 'bgRed', 'bgGreen', 'bgBlue', 'bgMagenta', 'bgYellow', 'bgCyan']
                   ];
const colors = require('colors');
const Fx = require('../dist/Fx.js').Fx;
let i1 = 0, i2 = 0;
const c = str => {
  str = colors[randcolors[0][i1]](colors[randcolors[1][i2]](str));
  i1 += 1;
  return str;
}
const cc = () => {
  i1 = 0;
  i2 += 1;
}

const A1 = new Fx(() => new Promise(resolve => {
  console.log('Produce A1');
  setTimeout(() => resolve(c('A1')), 100)
}));
let fxA2 = null;
setTimeout(() => { cc(); fxA2.failWith('error on A2') }, 10000);
const A2 = A1.pipe((a1, fx) => new Promise(resolve => {
  console.log('Produce A2');
  fxA2 = fx;
  setTimeout(() => resolve(a1 + ' ' + c('A2')), 100);
}));
let fxA3 = null;
setTimeout(() => { cc(); fxA3.failWith('error on A3') }, 15000);
const A3 = A2.pipe((a2, fx) => new Promise(resolve => {
  console.log('Produce A3');
  fxA3 = fx;
  setTimeout(() => resolve(a2 + ' ' + c('A3')), 100);
}));

const B1 = new Fx(() => new Promise(resolve => {
  console.log('Produce B1');
  setTimeout(() => resolve(c('B1')), 60)
}));
let fxB2 = null;
setTimeout(() => { cc(); fxB2.failWith('error on B2') }, 5000);
const B2 = B1.pipe((b1, fx) => new Promise(resolve => {
  console.log('Produce B2');
  fxB2 = fx;
  setTimeout(() => resolve(b1 + ' ' + c('B2')), 60);
}));
const B3 = B2.pipe((b2) => new Promise(resolve => {
  console.log('Produce B3');
  setTimeout(() => resolve(b2 + ' ' + c('B3')), 60);
}));

let fxAB3 = null;
setTimeout(() => { cc(); fxAB3.failWith('error on AB3') }, 20000);
const AB3 = A3.merge(async (a3, fx) => {
  console.log('Produce AB3');
  fxAB3 = fx;
  return B3.pipe(b3 => new Promise(resolve => {
    setTimeout(() => resolve(a3 + ' ' + b3 + ' ' + c('AB3')), 10);
  }));
});

let fxAB3C = null;
setTimeout(() => { cc(); fxAB3C.failWith('error on AB3C') }, 25000);
const AB3C = AB3.pipe((ab3, fx) => new Promise(resolve => {
  console.log('Produce AB3C');
  fxAB3C = fx;
  setTimeout(() => resolve(ab3 + ' ' + c('C')), 150);
}));

(async function self() {
  //debugger;
  const value = await AB3C.get();
  console.log('>    ' + value);
  return setTimeout(self, 1000);
})();
