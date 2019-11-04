import * as T from '../src/Type';

class R0 extends T.Record
  .add('foo', T.String.setDefault(42))
{
  foo: string;
}

class R1 extends R0
  .add('bar', T.Number)
{
  bar: number;
}

const r0 = R0.from({});
console.log(r0.foo);

const r1 = R1.from({ bar: 42 });
console.log(r1.foo, r1.bar);

console.log(T.isType(R1));

class R2 extends T.Record
  .add('col', T.Set(R0))
{
  col: Set<R0>
}

const r2 = R2.from({});
r2.col.add({ foo: '42' });

const D0 = T.DateTime;
D0.from(Date.now());