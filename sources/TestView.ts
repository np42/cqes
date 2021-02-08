import * as Component       from './Component';
import * as Query         from './QueryHandlers';
import * as TestQuery     from './TestQueryHandlers';

export { TestQuery };
//export { TestUpdate };

export interface props extends Component.props {
  queryHandlers: Query.Handlers;
  queryTesters:  TestQuery.Testers;
}

export class TestAggregate extends Component.Component {
  protected queryHandlers: Query.Handlers;
  protected queryTesters:  TestQuery.Testers;

  constructor(props: props) {
    if (props.context == null) throw new Error('Context is required');
    if (props.name    == null) throw new Error('Name is required');
    if (!(props.queryHandlers instanceof Query.Handlers))    throw new Error('Bad Query Handlers');
    if (!(props.queryTesters  instanceof TestQuery.Testers)) throw new Error('Bad Query Testers');
    super({ type: 'TestAggregate', ...props });
    this.queryHandlers = props.queryHandlers;
    this.queryTesters  = props.queryTesters;
  }

  public async runTests() {
    const context = this.queryTesters;
    const descriptors = Object.getOwnPropertyDescriptors(Object.getPrototypeOf(context));
    for (const query in descriptors) {
      if (/^[A-Z]/.test(query)) {
        const tester  = (<any>this.queryTesters)[query];
        if (typeof tester !== 'function') {
          this.logger.warn('Skip test %s, it is not a function', query);
          continue ;
        }
        const handler = (<any>this.queryHandlers)[query];
        if (handler == null) {
          this.logger.error('Handler %s not found', query);
          continue ;
        }
        try {
          const selfHandler = handler.bind(this.queryHandlers);
          await tester.call(context, () => new TestQuery.TestChain(context, selfHandler));
        } catch (e) {
          this.logger.error(e);
        }
      }
    }
  }

}