import { serializableClasses } from './serializable';

export const deserialize = (json: string): any => {
  return JSON.parse(json, (k, v) => {
    const possibleType = v[0];
    const overridableConstructor = serializableClasses.get(possibleType);
    if (overridableConstructor) {
      const [_, ...values] = v;
      return new overridableConstructor.constructor(...values);
    }
    return v;
  });
};
