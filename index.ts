import { Logger }          from './src/Logger';

import * as Process        from './src/Process';
import * as Component      from './src/Component';
import * as Bus            from './src/Bus';
import * as Interface      from './src/Interface';

import * as CommandHandler from './src/CommandHandler';
import * as Repository     from './src/Repository';
import * as Gateway        from './src/Gateway';
import * as Factory        from './src/Factory';

export { Logger, Process, Component, Bus, Interface
       , Gateway, CommandHandler, Factory, Repository
       };

export { command as C } from './src/command';
export { query as Q }   from './src/query';
export { reply as R }   from './src/reply';
export { event as E }   from './src/event';
export { state as S }   from './src/state';

import * as Fx           from './src/Fx';
import * as Lx           from './src/Lx';
import * as Mx           from './src/Mx';
import * as Qx           from './src/Qx';
import { Px }            from './src/Px';

export { Type }        from 'serializer.ts/Decorators';
import { deserialize } from "serializer.ts/Serializer";
export class Serializable<T> {
  constructor(data: any) {
    return deserialize<T>(this.constructor, data);
  }
}

export { Fx, Mx, Qx, Lx, Px };
