const MANGLE = '__serializable_type';

export const serialize = (object: any): string => {
  return JSON.stringify(object, (_, value) => {
    if (value && value[MANGLE]) {
      const props = value.toArray() as Array<any>;
      props.unshift(value[MANGLE]);
      return props;
    }
    return value?.toFixed ? Number(value.toFixed(3)) : value;
  });
};
