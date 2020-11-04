import { mangledTypeKey } from './mangled-type-key';
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

    Object.defineProperty(actual, mangledTypeKey, { value: target.name });
    Object.defineProperty(actual.prototype, mangledTypeKey, {
      value: target.name,
    });

    return actual;
  };
};
