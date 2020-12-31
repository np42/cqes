import { Sum, Object, Record, String, Number, Value } from 'cqes-type';


export class Command extends Object
  .add('context',  String)
  .add('category', String)
  .add('streamId', String)
  .add('data', Value)
  .add('meta', Value)
{
  context:  string;
  category: string;
  streamId: string;
  data:     any;
  meta:     any;
}

export class AST extends Sum
  .either('Command', Command)
{}