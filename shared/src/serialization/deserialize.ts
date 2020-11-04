import { serializableMapping } from './serializable-mapping';

export const deserialize = (json: string): any => {
  return JSON.parse(json, (_, v) => {
    if (v !== null && Object.prototype.hasOwnProperty.call(v, '0')) {
      const possibleType = v[0];
      const overridableConstructor = serializableMapping.get(possibleType);
      if (overridableConstructor) {
        return new overridableConstructor.constructor(...v.slice(1));
      }
      return v;
    }
    return v;
  });
};
