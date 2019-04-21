const ES = require('../dist/src/EventStore');
const uuid = require('uuid');
const { event } = require('../dist/src/event');

const es = new ES.EventStore({ address: '127.0.0.1:3456'
                             , db: '/tmp/cqes-test.evs'
                             })

class TestDone extends event {};

(async () => {
  await es.start();
})();
