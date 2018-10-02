import { Logger }       from './Logger';
import * as CQES        from './CQESBus';

import { Entity } from './Aggregate';
import { OutEvent
       , InEvent
       , EventData
       }                from './Event';
import { CommandData }  from './Command';
import { InQuery }      from './Query';

const CachingMap = require('caching-map');

export interface CachingMap<V> extends Map<string, V> {

}

type Typer      = { [event: string]: { new(data: any): EventData } };
type Reducer    = { $init?: any, [event: string]: (state: any, event: InEvent<any>) => any };
type Manager    = Object;
type Translator = Object;
type Projector  = Object;
type Automate   = Object;

export interface Options {
  size?: number;
  color?: string;
}

export interface Stream {
  typer: Typer;
  subscription?: any;
  group?: string;
}

export interface Topic {
  typer: Typer;
  subscription?: any;
}

export interface Request {
  typer: Typer;
  subscription?: any;
}






/***********************************/
