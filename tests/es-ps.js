const ES = require('../dist/src/EventStore');
const uuid = require('uuid');
const { event } = require('../dist/src/event');

const es = new ES.EventStore({ /* address: '127.0.0.1:3456', */ db: '/tmp/cqes-test.evs' })

class TestDone extends event {};

(async () => {
  const id = uuid();
  await es.start();
  await es.psubscribe('toto', 'Test', (id, revision, date, payload) => {
    console.log('E:', id, revision);
  });
  /*
  setTimeout(() => {
    console.log('ok');
    es.emit('Test', id, -1, Buffer.from('some data'));
  }, 1000);
  */
  //await es.emit('Test', id, -1, Buffer.from('some data'));
  //es.emit('Test', id, -1, Buffer.from('some data'));
})();
