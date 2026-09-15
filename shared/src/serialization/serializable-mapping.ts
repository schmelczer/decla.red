export type SerializableClass = { new (...args: Array<any>): unknown; name: string };

export const MANGLE = '__serializable_type';

export const serializableMapping = new Map<string, SerializableClass>();
