import * as Element from './Element';

import * as fs        from 'fs';

interface props extends Element.props {
  db:    string;
  pname: string;
}

const MAX_SIZE = 8192;
const NOOP = () => {};

export class PersistentSubscription extends Element.Element {
  public    cursor:   number;
  protected filename: string;
  protected length:   number;
  protected swaping:  boolean;
  protected mainFD:   number;
  protected nextFD:   number;
  protected pending:  number;
  protected writing:  number;

  constructor(props: props) {
    super(props);
    this.filename = props.db + '.' + props.pname + '.sub';
    this.cursor   = 0;
    this.length   = 0;
    this.swaping  = false;
    this.writing  = 0;
    this.pending  = 0;
  }

  public start(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      fs.open(this.filename, 'a+', (err, fd) => {
        if (err) return reject(err);
        this.mainFD = fd;
        this.readFD().then(resolve).catch(reject);
      });
    });
  }

  /**************************/

  protected readFD() {
    return new Promise((resolve, reject) => {
      const buffer = Buffer.alloc(MAX_SIZE + 6);
      let shift = 0;
      let position = 0;
      (function loop() {
        fs.read(this.mainFD, buffer, shift, MAX_SIZE, position, (err, bytes) => {
          if (err) return reject(err);
          if (bytes === MAX_SIZE) {
            position += bytes;
            shift = 6;
            buffer.copy(buffer, 0, bytes - 6, bytes);
            loop.call(this);
          } else {
            if (bytes < 6) this.cursor = 0;
            else this.cursor = buffer.readUInt32BE(shift + bytes - 4);
            return resolve();
          }
        });
      }).call(this);
    });
  }

  protected swapFD(chunk: Buffer) {
    if (this.swaping) return ;
    if (this.length > (MAX_SIZE * 2 / 3)) {
      this.swaping = true;
      fs.open(this.filename + '.next', 'a', (err, fd) => {
        if (err) {
          this.swaping = false;
          this.logger.error(err);
        } else {
          this.length = 0;
          fs.write(fd, chunk, (err, bytes) => {
            if (err) {
              this.swaping = false;
              this.logger.error(err);
              fs.close(fd, NOOP);
            } else {
              fs.rename(this.filename + '.next', this.filename, err => {
                this.swaping = false;
                if (err) {
                  this.logger.error(err);
                  fs.close(fd, NOOP);
                } else {
                  fs.close(this.mainFD, NOOP);
                  this.mainFD = fd;
                }
              })
            }
          });
        }
      })
    }
  }

  protected writeFD(position: number) {
    const chunk = Buffer.from( [ 0, 0
                               , (position >>> 24) & 0xff, (position >>> 16) & 0xff
                               , (position >>> 8) & 0xff, position & 0xff
                               ]
                             );
    this.writing += 1;
    fs.write(this.mainFD, chunk, (err, bytes) => {
      this.writing -= 1;
      this.length += bytes;
      this.cursor = position;
      this.swapFD(chunk);
      this.handleWriteResult(this.mainFD, bytes, chunk);
    });
  }

  protected handleWriteResult(fd: number, bytesWritten: number, chunk: Buffer) {
    
    this.drain();
  }

  protected drain() {
    if (!(this.writing === 0 && this.pending > 0)) return ;
    //console.log('D:', this.pending);
    const length = this.pending;
    this.pending = 0;
    this.writeFD(this.cursor + length);
  }

  /**************************/

  forward(length: number) {
    //console.log('L:', length);
    const position = this.cursor + length;
    if (this.writing > 0) {
      //console.log('P:', this.pending);
      this.pending += length;
    } else {
      this.writeFD(position);
    }
  }

}
