//--
import * as Process    from './sources/Process';
import * as Component  from './sources/Component';
import { Logger }      from './sources/Logger';

export { Process, Component, Logger };

//--
import * as Aggregate     from './sources/Aggregate';
import * as Repository    from './sources/Repository';
import * as Service       from './sources/Service';
import * as View          from './sources/View';
import * as Trigger       from './sources/Trigger';

export { Aggregate, Repository, Service, View, Trigger };

//--
import { Command as C } from './sources/Command';
import { Query   as Q } from './sources/Query';
import { Reply   as R } from './sources/Reply';
import { Event   as E } from './sources/Event';
import { State   as S } from './sources/State';

export { C, Q, R, E, S };

//--
export * as Types    from './sources/Types';