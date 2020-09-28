import { createWriteStream } from 'fs';
import { join, dirname } from 'path';
import Busboy from 'busboy';
import mkdirp from 'mkdirp';

function formData(
  contType: string,
  options: busboy.BusboyConfig & {
    abortOnLimit?: boolean;
    tmpDir?: string;
    onFile?: (
      fieldname: string,
      file: NodeJS.ReadableStream,
      filename: string,
      encoding: string,
      mimetype: string
    ) => string;
    onField?: (fieldname: string, value: any) => void;
    filename?: (oldName: string) => string;
  } = {}
) {
  options.headers = {
    'content-type': contType
  };

  return new Promise((resolve, reject) => {
    const busb = new Busboy(options);
    const ret = {};

    this.bodyStream().pipe(busb);

    busb.on('limit', () => {
      if (options.abortOnLimit) {
        reject(Error('limit'));
      }
    });

    busb.on('file', function(fieldname, file, filename, encoding, mimetype) {
      const value = {
        filename,
        encoding,
        mimetype,
        filePath: undefined
      };

      if (typeof options.tmpDir === 'string') {
        if (typeof options.filename === 'function') filename = options.filename(filename);
        const fileToSave = join(options.tmpDir, filename);
        mkdirp(dirname(fileToSave));

        file.pipe(createWriteStream(fileToSave));
        value.filePath = fileToSave;
      }
      if (typeof options.onFile === 'function') {
        value.filePath =
          options.onFile(fieldname, file, filename, encoding, mimetype) || value.filePath;
      }

      setRetValue(ret, fieldname, value);
    });

    busb.on('field', function(fieldname, value) {
      if (typeof options.onField === 'function') options.onField(fieldname, value);

      setRetValue(ret, fieldname, value);
    });

    busb.on('finish', function() {
      resolve(ret);
    });

    busb.on('error', reject);
  });
}

function setRetValue(
  ret: { [x: string]: any },
  fieldname: string,
  value: { filename: string; encoding: string; mimetype: string; filePath?: string } | any
) {
  if (fieldname.slice(-2) === '[]') {
    fieldname = fieldname.slice(0, fieldname.length - 2);
    if (Array.isArray(ret[fieldname])) {
      ret[fieldname].push(value);
    } else {
      ret[fieldname] = [value];
    }
  } else {
    if (Array.isArray(ret[fieldname])) {
      ret[fieldname].push(value);
    } else if (ret[fieldname]) {
      ret[fieldname] = [ret[fieldname], value];
    } else {
      ret[fieldname] = value;
    }
  }
}

export default formData;
