export type SerializableClass = {
  new (...args: Array<any>): { toArray(): Array<any> };
  name: string;
};
