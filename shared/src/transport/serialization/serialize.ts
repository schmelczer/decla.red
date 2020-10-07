export const serialize = (object): string => {
  return JSON.stringify(object, (_, value) => {
    if (value?.__serializable_type) {
      return [value.__serializable_type, ...value.toArray()];
    }
    return value?.toFixed ? Number(value.toFixed(3)) : value;
  });
};
