import * as CQES     from 'cqes'
import { Commands }  from './User.Commands'
import { Events }    from './User.Events'
import { Aggregate } from './User.Aggregate'
import { Reducer }   from './User.Reducer'
import { Manager }   from './User.Manager'

export const Aggregator = new CQES.Aggregator(Aggregate)
  .from('$ce-User', Events, Reducer)
  .listen('User', Commands, Manager)
