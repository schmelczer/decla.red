// deserialize reconstructs via `new Ctor(...array.slice(1))`, so the field list
// MUST name the constructor's parameters in order. Derived (non-serialized)
// fields are deliberately absent.
export const toArrayFromFields = (
  object: any,
  fields: ReadonlyArray<string>,
): Array<any> => fields.map((field) => object[field]);
