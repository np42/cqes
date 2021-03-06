const ES = require('../dist/src/EventStore');
const uuid = require('uuid');
const { event } = require('../dist/src/event');

const es = new ES.EventStore({ address: '127.0.0.1:3456', db: '/tmp/cqes-test.evs' })

class TestDone extends event {};

(async () => {
  await es.start();
  while (true)
    await es.emit('Test', uuid(), -1, Buffer.from(JSON.stringify([new TestDone({ some: 'data' })])));
})();
