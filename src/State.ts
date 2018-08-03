import { InEvent } from './Event';

export class State<D extends StateData> {
  public process:   string;
  public position:  any;
  public data:      D;

  constructor(StateDataClass?: new (_: any) => D, data?: any, position?: any) {
    if (StateDataClass == null) StateDataClass = <any>DummyStateData;
    if (position == null) position = -1;
    this.process  = StateDataClass.name;
    this.position = position;
    this.data     = new StateDataClass(data);
  }

}

export class StateData {

  public id: string;

  protected type(event: InEvent<any>) {
    return event;
  }

  public apply(events: InEvent<any> | Array<InEvent<any>>): void {
    if (!(events instanceof Array)) events = [events];
    for (const event of events) {
      if (!(event.type in this)) continue ;
      const typedEvent = this.type(event);
      this[event.type](typedEvent);
    }
  }

  public toString() {
    return this.id;
  }

}

class DummyStateData extends StateData {}

