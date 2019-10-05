import { props }      from './Bus';
import { Stream }     form './Stream';
import { Service }    from './Service';
import { Repository } from './Repository';
import { Projection } from './Projection';
import { Helper }     from './Helper';

export interface Hive {
  props:        props;
  streams:      { [name: string]: Stream };
  services:     { [name: string]: Service };
  repositories: { [name: string]: Repository };
  projections:  { [name: string]: Projection };
  helpers:      { [name: string]: Helper };
}
