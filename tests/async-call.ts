import { AsyncCall }      from '../sources/AsyncCall';
import { Record, String } from 'cqes-type';

describe('AsyncCall', function () {

  class RespA extends Record.locate(__filename) {};
  class RespB extends Record.locate(__filename) {};

  it('should call the correspondiing handler', function (done) {
    const call = new AsyncCall()
      .on(RespA, () => { done('Bad type'); })
      .on(RespB, () => { done(); })
      .onError(() => { done('should not happend'); })
    setTimeout(() => call.reply('RespB', {}), 1);
  });

  it('should call end handler if no corresponding handler defined', function (done) {
    const call = new AsyncCall()
      .on(RespA, () => { done('Bad type'); })
      .onError(() => { done('should not happend'); })
      .onEnd(() => { done(); })
    setTimeout(() => call.reply('RespB', {}), 1);
  });

  it('should call timeout handler', function (done) {
    const call = new AsyncCall()
      .on(RespA, () => { done('Should timeout before'); })
      .setTimeout(1, () => { done(); })
    setTimeout(() => {
      try {
        call.reply('RespA', {});
        done('Should be rejected');
      } catch (e) {}
    }, 3);
  });

  it('should call error handler if no timeout handler defined', function (done) {
    const call = new AsyncCall({ timeout: 1 })
      .on(RespA, () => { done('Bad type'); })
      .onError(() => { done(); })
  });

});
