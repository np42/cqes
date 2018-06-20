export class Serializable {
  serialize() {
    return new Buffer(JSON.stringify(this));
  }
}
