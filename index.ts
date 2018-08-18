import _Logger from './src/Logger'
import * as P from './src/Process'
import * as S from './src/Service'
import * as V from './src/ValueObject'
import * as B from './src/Entity'
import * as AR from './src/AggregateRoot'
import * as C from './src/Command'
import * as Q from './src/Query'
import * as E from './src/Event'
import * as A from './src/State'
import * as F from './src/Fx'
import * as M from './src/Mx'
import * as L from './src/Lx'

export const Process       = P.default
export const Service       = S.Service
export const ValueObject   = V.ValueObject
export const Entity        = B.Entity
export const AggregateRoot = AR.AggregateRoot
export const Logger        = _Logger

export const InCommand   = C.InCommand
export const OutCommand  = C.OutCommand
export const CommandData = C.CommandData

export const InQuery     = Q.InQuery
export const OutQuery    = Q.OutQuery

export const InReply     = Q.InReply
export const OutReply    = Q.OutReply

export const InEvent     = E.InEvent
export const OutEvent    = E.OutEvent
export const EventData   = E.EventData

export const State       = A.State
export const StateData   = A.StateData

export const Fx          = F
export const Mx          = M
export const Lx          = L
