### Features:

  - Manage services maping to system process
  - Has powerfull config loader (host constant based, internal reference, layers overwrite, includes, ...)
  - Has hardened adapters HTTP, AMQP, MySQL to perform action with smart retry policy
  - Has Command queuing via AMQP adapter
  - Handle Queries & Replies via HTTP
  - Implements Event Optimistic Concurency Control
  - Handle Event persistence via MySQL
  - Handle Event dispatching via Redis pub/sub
  - Each service can be either:
    - Aggregate ( Command Handler, Factory, Repository )
    - View ( Update Handler, Query Handler )
    - Saga ( Event Handler, Repository )
    - or anything else and can access HTTP, AMQP, MySQL adapters easily
  - Has strong type checking: static via TypeScript and runtime (exemple Email validation)
  - Has super fast and customizable pattern matching engine
  - Has unified Logger component

### TODO:

  - Finish Testing environment
  - Implement EventStore event bus
  - Make adapter injectable
