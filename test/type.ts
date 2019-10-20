import * as T from '../src/Type';

class R0 extends T.Record
  .add('field', T.String, 42)
{
  field: string;
}

class R1 extends R0
  .add('pli', T.Number)
{
  pli: number;
}

const r0 = R0.from({});
console.log(r0.field);

const r1 = R1.from({ pli: 42 });
console.log(r1.field, r1.pli);

console.log(T.isType(R1));