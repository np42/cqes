process.on('unhandledRejection', console.log);

const url  = 'amqp://xmsv3:I2Lhf2ydyIUXGcMASPJK@localhost/';

let number = 0;
const topics = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const t = () => 'Test-' + topics[topics.length * Math.random() | 0];
/*/
const CB = new AMQPCommandBus(url);
CB.listen('Test', command => {
  process.stdout.write(command.orderData.number + ' ');
  command.ack();
});
for (const t of topics) {
  const topic = 'Test-' + t;
  CB.listen(topic, command => {
    process.stdout.write(topic.substr(5) + command.orderData.number + ' ');
    command.ack();
  });
}
/*/
const QB = new AMQPQueryBus(url);
QB.serve('Test', query => {
  query.resolve({ str: query.data.number + ' => RPC OK' });
});
//setInterval(() => {
QB.query(new Query('Test', '/', { number: ++number }))
  .then(reply => console.log('RPC RESULT', reply.value));
//}, 100);
/**/

/*/
function loop() {
  for (var i = 0; i < 10000; i++) {
    setImmediate(() => {
      CB.command(new Command(t(), 'Timed', { number: ++number }))
      i -= 1;
      if (i == 0) setTimeout(loop, 100);
    });
  }
}
loop();
//
setInterval(async () => {
  //await CB.command(new Command(t(), 'Timed', { number: ++number }))
  await CB.command(new Command('Test', 'Timed', { number: ++number }))
  process.stdout.write('.');
}, 100);
/**/
