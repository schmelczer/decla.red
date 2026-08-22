import { SerializableClass, serializableMapping } from './serializable-mapping';

const MANGLE = '__serializable_type';

export const serializesTo = (target: SerializableClass) => {
  return (actual: SerializableClass): any => {
    if (!serializableMapping.has(target.name)) {
      serializableMapping.set(target.name, target);
    }

    Object.defineProperty(actual, MANGLE, { value: target.name });
    Object.defineProperty(actual.prototype, MANGLE, { value: target.name });

    return actual;
  };
};
