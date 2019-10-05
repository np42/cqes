import { Value, Record, Entity, Aggregate, Enum
       , _Time, _Date, _Email
       , _String, _Number
       } from '../src/Model';

class Test extends Record
  .add('field', _String)
  .add('from', Record.add('k', _String))
{
  field: string;
  from: { k: string };
}

debugger;
const test = new Test({ field: 42, from: { k: 42 } });

if (test.field === '42')
  console.log(typeof test.from.k, test.from.k);