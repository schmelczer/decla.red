import { serializableMapping } from './serializable-mapping';

export const deserialize = (json: string): any => {
  return JSON.parse(json, (_, v) => {
    if (v !== null && Object.prototype.hasOwnProperty.call(v, '0')) {
      const Ctor = serializableMapping.get(v[0]);
      if (Ctor) {
        return new Ctor(...v.slice(1));
      }
      return v;
    }
    return v;
  });
};
