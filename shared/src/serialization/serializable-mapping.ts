export type SerializableClass = { new (...args: Array<any>): unknown; name: string };

// Wire format: the property the decorators stamp on and serialize() looks for
// to recognise a decorated class. Defined once on purpose — per-file copies
// would have to agree byte-for-byte, and a typo in one of them compiles and
// type-checks cleanly while every networked object degrades to a raw array.
export const MANGLE = '__serializable_type';

export const serializableMapping = new Map<string, SerializableClass>();
