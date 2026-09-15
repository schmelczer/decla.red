import { serializableMapping } from './serializable-mapping';

export const deserialize = (json: string): any =>
  JSON.parse(json, (_, value) => {
    if (Array.isArray(value) && typeof value[0] === 'string') {
      const Ctor = serializableMapping.get(value[0]);
      if (Ctor) {
        return new Ctor(...value.slice(1));
      }
    }
    return value;
  });
