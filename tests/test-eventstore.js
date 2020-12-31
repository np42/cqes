
const url = 'tcp://admin:changeit@localhost:1113';

const EB = new ESEventBus(url);

/*/
let count = 0;
const subscription = EB.subscribe('Test', 0, async event => {
  //if (event.eventType == '$liveReached') subscription.do(async sub => sub.stop());
  console.log(event.eventType, ++count);
});
/*/
//EB.last('Test', 1).then(console.log);
/**/

/*/
//EB.tweak('Test', -2, { $maxCount: 1000 })
/*/
const thread = 1;
const delay = 100;

let number = 0;
let last = Date.now();
for (let i = 0; i < thread; i++) {
  setInterval(() => {
    if (number % 100 == 0) process.stdout.write('.');
    if (number % 10000 == 0) {
      process.stdout.write((Date.now() - last) + '\n');
      last = Date.now();
    }
    EB.publish('Test', -2, [new Event('', 'Dummy', { some: ++number })])
      .catch((e) => { console.log(e, 'can not push this event'); });
  }, delay);
}
/**/

