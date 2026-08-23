import { MANGLE } from './serializable-mapping';

export const serialize = (object: any): string =>
  JSON.stringify(object, (_, value) => {
    if (value && value[MANGLE]) {
      return [value[MANGLE], ...value.toArray()];
    }
    return typeof value === 'number' ? Math.round(value * 1000) / 1000 : value;
  });
