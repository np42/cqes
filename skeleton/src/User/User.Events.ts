import { EventData } from 'cqes'

export namespace Events {

  export class Created extends EventData {
    public name: string;
    constructor (data: any) {
      super();
      this.name = data.name
    }
  }

  export class ChannelJoined extends EventData {
    public name: string;
    constructor (data: any) {
      super();
      this.name = data.name;
    }
  }

  export class ChannelLeaved extends EventData {
    public name: string;
    constructor (data: any) {
      super();
      this.name = data.name;
    }
  }

}
