import * as Component       from './Component';
import * as Command         from './CommandHandlers';
import * as TestCommand     from './TestCommandHandlers';

export { TestCommand };


export interface props extends Component.props {
  commandHandlers: Command.Handlers;
  commandTesters:  TestCommand.Testers;
}

export class TestAggregate extends Component.Component {
  protected commandHandlers: Command.Handlers;
  protected commandTesters:  TestCommand.Testers;

  constructor(props: props) {
    if (props.context == null) throw new Error('Context is required');
    if (props.name    == null) throw new Error('Name is required');
    if (!(props.commandHandlers instanceof Command.Handlers)) throw new Error('Bad Command Handlers');
    if (!(props.commandTesters  instanceof TestCommand.Testers)) throw new Error('Bad Command Testers');
    super({ type: 'TestAggregate', ...props });
    this.commandHandlers = props.commandHandlers;
    this.commandTesters  = props.commandTesters;
  }

  public async runTests() {
    const context = this.commandTesters;
    const descriptors = Object.getOwnPropertyDescriptors(Object.getPrototypeOf(context));
    for (const command in descriptors) {
      if (/^[A-Z]/.test(command)) {
        const tester  = (<any>this.commandTesters)[command];
        if (typeof tester !== 'function') {
          this.logger.warn('Skip test %s, it is not a function', command);
          continue ;
        }
        const handler = (<any>this.commandHandlers)[command];
        if (handler == null) {
          this.logger.error('Handler %s not found', command);
          continue ;
        }
        try {
          const selfHandler = handler.bind(this.commandHandlers);
          await tester.call(context, () => new TestCommand.TestChain(context, selfHandler));
        } catch (e) {
          this.logger.error(e);
        }
      }
    }
  }

}