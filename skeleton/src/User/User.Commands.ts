import { CommandData } from 'cqes'

export namespace Commands {
  export class PostMessage extends CommandData {
    public channel: string;
    public message: string;
    constructor(data: any) {
      super();
      this.channel = data.channel;
      this.message = data.message;
    }
  }
}
