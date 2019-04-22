const ES = require('../dist/src/EventStore');
const uuid = require('uuid');
const { event } = require('../dist/src/event');

const es = new ES.EventStore({ address: '127.0.0.1:3456', db: '/tmp/cqes-test.evs' })

class TestDone extends event {};

const ids = [ '25aa8ec4-8afe-456b-8e3e-467cf3a3f1e7', '83050436-ffff-48f0-87b7-f456fe413aeb'
            , 'f46e5370-82c8-4cc6-a71b-b046db63f665', 'd05c2cdd-6a75-4ae9-b9b8-44bb85f0b04f'
            , uuid()
            ];

(async () => {
  await es.start();
  const id = ids[Math.random() * ids.length | 0];
  await es.emit('Test', id, -1, Buffer.from(JSON.stringify([new TestDone({ some: 'data' })])));
})();
