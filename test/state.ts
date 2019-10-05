import { Record, Entity, Aggregate, Enum
       , _Time, _Date, _Email
       , _String, _Number
       } from '../src/Model';

export class Location extends Aggregate
  .add('longitude', _Number)
  .add('latitude', _Number)
{
  longitude: number;
  latitude: number;
}

export class Product extends Entity
  .add('label', _String)
  .add('price', _Number)
  .add('duration', _Time)
{
  label: string;
  price: number;
  duration: string;
}

export class Client extends Entity
  .add('fullname', _String)
  .add('address', _String)
  .add('location', Location.ID)
{
  fullname: string;
  address:  string;
  location: string;
}

export class Appointment extends Entity
  .add('date', _Date)
  .add('time', _Time)
  .add('daypart', Enum.of('am', 'pm'))
  .add('duration', _Time)
  .add('travelDuration', _Time)
  .add('location', Location.ID.opt())
  .add('client', Client.ID.opt())
{
  date: string;
  time: string;
  daypart: 'am' | 'pm';
  duration: string;
  travelDuration: string;
  location: string;
  client: string;
}

export class Day extends Record
  .add('availability', Record.of({ begin: _Time, end: _Time }).opt())
  .add('am', Appointment.ID.Array)
  .add('pm', Appointment.ID.Array)
{
  availability: { begin: string, end: string };
  am: Array<string>;
  pm: Array<string>;
}

export class Planning extends Entity
  .add('dates', Day.Map(_Date))
{
  dates: Map<string, Day>;
}

export class Cleaner extends Entity
  .add('fullname', _String)
  .add('email', _Email.opt())
  .add('planning', Planning)
{
  fullname: string;
  email:    string;
  planning: string;
}

export class Maintenance extends Aggregate
  .add('products', Product.ByID)
  .add('cleaners', Cleaner.ByID)
  .add('appointments', Appointment.ByID)
  .add('clients', Client.ByID)
{
  cleaners: Map<string, Cleaner>;
  products: Map<string, Product>;
  appointments: Map<string, Appointment>;
  clients: Map<string, Client>;
}

const now = Date.now();
const maintenance = Maintenance.from
( { ID: '5a6637e7-4766-4c82-b0d0-613f6cf7228a'
  , cleaners: [['toto', { fullname: 'Toto'
                        , planning: { dates: [['2019-05-28', { am: ['42'] }]] }
                        }
               ]]
  , appointments: [['42', { daypart: 'am' }]]
  }
);
console.log('time:', Date.now() - now);

console.log(JSON.stringify(maintenance));
