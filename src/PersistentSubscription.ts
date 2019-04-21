import * as Component from './Component';

import * as fs        from 'fs';

interface props extends Component.props {
  db:   string;
  name: string;
}

interface children extends Component.children {}

const MAX_SIZE = 8192;

export class PersistentSubscription extends Component.Component {
  public    cursor:   number;
  protected filename: string;
  protected length:   number;
  protected swaping:  boolean;
  protected mainFD:   number;
  protected nextFD:   number;

  constructor(props: props, children: children) {
    super(props, children);
    this.filename = props.db + '.' + props.name;
    this.cursor   = 0;
    this.length   = 0;
    this.swaping  = false;
  }

  public start() {
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
      const buffer = new Buffer.alloc(MAX_SIZE);
      fs.read(this.mainFD, buffer, 0, MAX_SIZE, 0, (err, bytes) => {
        if (err) return reject(err);
        if (bytes === MAX_SIZE) {
          
        } else {
          this.cursor = buffer.readUInt32BE(bytes - 4);
          return resolve();
        }
      });
    });
  }

  protected swapFD() {
    if (this.swaping) return ;
    if (this.length > (MAX_SIZE * 2 / 3)) {
      this.swaping = true;
      fs.open(this.filename + '.next', 'a', (err, fd) => {
        if (err) {
          this.swaping = false;
          this.logger.error(err);
        } else {
          this.nextFD = fd;
          fs.rename(this.filename + '.next', this.filename, err => {
            this.swaping = false;
            this.nextFD = null;
            if (err) this.logger.error(err);
          })
        }
      })
    }
  }

  protected writeFD(position, number) {
    const chunk = Buffer.from( [ 0, 0
                               , (position >> 0xffffff) & 0xff, (position >> 0xffff) & 0xff
                               , (position >> 0xff) & 0xff, position & 0xff
                               ]
                             );
    this.logger.error('handle async writes (queue)');
    fs.write(this.mainFD, chunk);
    if (this.nextFD > 0) fs.write(this.nextFD, chunk);
    this.length += chunk.length;
  }

  /**************************/

  forward(position: number) {
    this.writeFD(position);
    this.swapFD();
  }

}
