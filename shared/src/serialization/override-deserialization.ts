import { serializableMapping, SerializableClass } from './serializable-mapping';

export const overrideDeserialization = (
  source: SerializableClass,
  target: SerializableClass,
) => {
  serializableMapping.set(source.name, target);
};
