import { mangledTypeKey } from './mangled-type-key';
import { SerializableClass } from './serializable-class';
import { serializableMapping } from './serializable-mapping';

export const serializable = (type: SerializableClass): any => {
  if (!serializableMapping.get(type.name)) {
    serializableMapping.set(type.name, {
      constructor: type,
      overridden: false,
    });
  }

  Object.defineProperty(type, mangledTypeKey, { value: type.name });
  Object.defineProperty(type.prototype, mangledTypeKey, { value: type.name });

  return type;
};
