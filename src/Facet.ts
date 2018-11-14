import * as C from './Command';
import * as Q from './Query';
import * as E from './Event';
import * as S from './State';

export interface Command {
  fromJs: (command: C.Command) => any;
  toJs:   (command: any) => C.Command;
}

export interface Query {
  fromJs: (query: Q.Query) => any;
  toJs:   (reply: any) => Q.Reply;
}

export interface Event {
  fromJs: (event: E.Event) => any;
  toJs:   (event: any) => E.Event;
}

export interface State {
  fromJs: (state: S.State) => any;
  toJs:   (state: any) => S.State;
}
/*
export interface Gateway {

}
*/

export interface Filter {

}

export interface Manager {
  [order: string]: (state: any, command: any) => Promise<{ events: Array<any>, commands: Array<any> }>;
}

export interface Factory {
  [name: string]: (state: any, event: any) => any;
}

export interface Repository {
  load: (key: string) => Promise<State>;
  save: (key: string, state: State) => Promise<void>;
  [view: string]: (buffer: any, query: any) => Promise<any>;
}

export interface Reactor {
  [name: string]: (state: any, event: any) => Array<any>;
}
