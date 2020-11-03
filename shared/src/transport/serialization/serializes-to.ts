import { SerializableClass } from './serializable-class';
import { serializableMapping } from './serializable-mapping';

export const serializesTo = (target: SerializableClass) => {
  return (actual: SerializableClass): any => {
    if (!serializableMapping.get(target.name)) {
      serializableMapping.set(target.name, {
        constructor: target,
        overridden: false,
      });
    }

    Object.defineProperty(actual, '__serializable_type', { value: target.name });
    Object.defineProperty(actual.prototype, '__serializable_type', {
      value: target.name,
    });

    return actual;
  };
};
