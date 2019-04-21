const ES = require('../dist/src/EventStore');
const uuid = require('uuid');
const { event } = require('../dist/src/event');

const es = new ES.EventStore({ address: '127.0.0.1:3456', db: '/tmp/cqes-test.evs' })

class TestDone extends event {};

(async () => {
  const id = uuid();
  await es.start();
  for (let i = 0; i < 100; i++)
    await es.emit('Test', id, -1, JSON.stringify([new TestDone({ some: 'data' })]));
  es.subscribe('Test', (id, revision, date, payload) => {
    console.log('Subscription >>> ', id, revision, date, payload);
  });
  for (let i = 0; i < 10; i++)
    await es.emit('Test', id, -1, JSON.stringify([new TestDone({ some: 'data' })]));
})();
