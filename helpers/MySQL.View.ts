import { View, Q, R, E }          from '..';
import * as MySQL                 from 'cqes-mysql';

export interface props extends View.Request.props {
  MySQL: MySQL.props;
};

export class UpdateHandlers extends View.Update.Handlers {
  protected mysql:   MySQL.MySQL;

  constructor(props: props) {
    super(props);
    this.mysql = new MySQL.MySQL({ name: props.name, ...props.MySQL });
  }

  public async start() {
    await this.mysql.start();
    await super.start();
  }

  public async stop() {
    await super.stop();
    await this.mysql.stop();
  }

}

export class RequestHandlers extends View.Request.Handlers {
  protected mysql:   MySQL.MySQL;

  constructor(props: props) {
    super(props);
    this.mysql = new MySQL.MySQL({ name: props.name, ...props.MySQL });
  }

  public async start() {
    await this.mysql.start();
    await super.start();
  }

  public async stop() {
    await super.stop();
    await this.mysql.stop();
  }

}


export class QueryHandlers extends View.Query.Handlers {
  protected mysql:   MySQL.MySQL;

  constructor(props: props) {
    super(props);
    this.mysql = new MySQL.MySQL({ name: props.name, ...props.MySQL });
  }

  public async start() {
    await this.mysql.start();
    await super.start();
  }

  public async stop() {
    await super.stop();
    await this.mysql.stop();
  }

}