export const jsonSerialize = (o: any): string =>
  JSON.stringify(o, (key, value) => (value?.toFixed ? Number(value.toFixed(3)) : value));
