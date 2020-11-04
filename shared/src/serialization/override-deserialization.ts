import { DeserializableClass } from './deserializable-class';
import { SerializableClass } from './serializable-class';
import { serializableMapping } from './serializable-mapping';

export const overrideDeserialization = (
  source: SerializableClass,
  target: DeserializableClass,
) => {
  serializableMapping.set(source.name, {
    constructor: target,
    overridden: true,
  });
};
