import { HttpResponse } from 'uWebSockets.js';
import { ReadStream } from 'fs';

function writeHeaders(
  res: HttpResponse,
  headers: { [name: string]: string } | string,
  other?: string
) {
  if (typeof headers === 'string') {
    res.writeHeader(headers, other.toString());
  } else {
    for (const n in headers) {
      res.writeHeader(n, headers[n].toString());
    }
  }
}

function extend(who: object, from: object, overwrite = true) {
  const ownProps = Object.getOwnPropertyNames(Object.getPrototypeOf(from)).concat(
    Object.keys(from)
  );
  ownProps.forEach(prop => {
    if (prop === 'constructor' || from[prop] === undefined) return;
    if (who[prop] && overwrite) {
      who[`_${prop}`] = who[prop];
    }
    if (typeof from[prop] === 'function') who[prop] = from[prop].bind(who);
    else who[prop] = from[prop];
  });
}

function stob(stream: ReadStream): Promise<Buffer> {
  return new Promise(resolve => {
    const buffers = [];
    stream.on('data', buffers.push.bind(buffers));

    stream.on('end', () => {
      switch (buffers.length) {
        case 0:
          resolve(Buffer.allocUnsafe(0));
          break;
        case 1:
          resolve(buffers[0]);
          break;
        default:
          resolve(Buffer.concat(buffers));
      }
    });
  });
}

export { writeHeaders, extend, stob };
