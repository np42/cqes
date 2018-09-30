import { InCommand } from 'cqes'
import { Commands  } from './User.Commands'
import { Aggregate } from './User.Aggregate'

export namespace Manager {

  function PostMessage(state: Aggregate, command: InCommand<Commands.PostMessage>) {
    return <any[]>[];
  }

}
