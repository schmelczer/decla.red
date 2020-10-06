export const serialize = (object): string => {
  const result = JSON.stringify(object, (key, value) => {
    if (value?.type) {
      return [value.type, ...value.toArray()];
    }
    return value?.toFixed ? Number(value.toFixed(3)) : value;
  });

  return result;
};
