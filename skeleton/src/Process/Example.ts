import { Process, Service
       , State, InCommand, CommandData, OutEvent
       } from 'cqes';

interface Options {
  data: string;
}

Process.registerService(class Example extends Service {
  private data: string;

  constructor(config: Options) {
    super(config);
    this.data = config.data;
    this.listen('Example', new State(), ExampleCommands);
  }


  MakeTest(state: State<any>, command: InCommand<ExampleCommands.MakeTest>) {
    console.log(this.data, command.data.text);
    return <Array<OutEvent<any>>>[];
  }

});

namespace ExampleCommands {
  export class MakeTest extends CommandData {
    public text: string;
    constructor(data: any) {
      super();
      this.text = data.text;
    }
  }
}

Process.run();
