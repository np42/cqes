import { InEvent }   from 'cqes'
import { Aggregate } from './User.Aggregate'
import { Events }    from './User.Events'

export namespace Reducer {

  function Created(state: Aggregate, event: InEvent<Events.Created>) {
    return state;
  }

  function ChannelJoined(state: Aggregate, event: InEvent<Events.ChannelJoined>) {
    return state;
  }

  function ChannelLeaved(state: Aggregate, event: InEvent<Events.ChannelLeaved>) {
    return state;
  }

}
