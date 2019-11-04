let counter = 0;
let lastTs  = 0;
export function genId() {
  const ts = Date.now();
  if (lastTs == ts) counter = (counter + 1) % 0xffff;
  else { lastTs = ts; counter = 0 }
  const buffer = Buffer.alloc(12);
  const tsbin  = ts.toString(2);
  const left   = tsbin.substring(0, tsbin.length - 32);
  const right  = tsbin.substr(-32);
  buffer.writeUInt32BE(parseInt(left, 2), 0);
  buffer.writeUInt32BE(parseInt(right, 2), 4);
  buffer.writeUInt16BE(counter, 8);
  buffer.writeUInt16BE(Math.random() * 0xffff | 0, 10);
  return buffer.toString('base64');
}
