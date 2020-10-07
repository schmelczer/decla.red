import { serializableMapping } from './serializable-mapping';

export const deserialize = (json: string): any => {
  return JSON.parse(json, (k, v) => {
    const possibleType = v[0];
    const overridableConstructor = serializableMapping.get(possibleType);
    if (overridableConstructor) {
      v.shift();
      return new overridableConstructor.constructor(...v);
    }
    return v;
  });
};
