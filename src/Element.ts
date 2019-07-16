import { Logger } from './Logger';

export interface props {
  context:  string;
  module?:  string;
  service?: string;
  logger:   Logger;
}

export class Element {
  protected context:  string;
  protected module?:  string;
  protected service?: string;
  protected logger:   Logger;

  constructor(props: props) {
    this.context = props.context;
    if (props.module)
      this.module  = props.module;
    if (props.service)
      this.service = props.service;
    this.logger  = props.logger;
  }

}