export const serialize = (object: any): string => {
  return JSON.stringify(object, (_, value) => {
    if (value?.__serializable_type) {
      const props = value.toArray() as Array<any>;
      props.unshift(value.__serializable_type);
      return props;
    }
    return value?.toFixed ? Number(value.toFixed(3)) : value;
  });
};
