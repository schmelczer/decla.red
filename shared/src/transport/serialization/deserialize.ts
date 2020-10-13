import { serializableMapping } from './serializable-mapping';

export const deserialize = (json: string): any => {
  return JSON.parse(json, (k, v) => {
    if (v !== null && Object.prototype.hasOwnProperty.call(v, '0')) {
      const possibleType = v[0];
      const overridableConstructor = serializableMapping.get(possibleType);
      if (overridableConstructor) {
        v.shift();
        return new overridableConstructor.constructor(...v);
      }
      return v;
    }
    return v;
  });
};
