// Derive a serializable object's positional wire array from a single declared
// list of field names, so toArray() and the constructor share ONE source of
// truth for field order instead of a hand-written array that can silently drift
// out of step with the parameters.
//
// deserialize reconstructs via `new Ctor(...array.slice(1))`, so the field list
// MUST name the constructor's parameters in order. Fields a constructor
// recomputes from others (e.g. a planet's centre/radius from its vertices) are
// derived, not serialized, and so are deliberately absent from the list.
export const toArrayFromFields = (
  object: any,
  fields: ReadonlyArray<string>,
): Array<any> => fields.map((field) => object[field]);
