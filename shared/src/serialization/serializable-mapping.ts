export type SerializableClass = { new (...args: Array<any>): unknown; name: string };

export const serializableMapping = new Map<string, SerializableClass>();
