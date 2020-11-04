import { mangledTypeKey } from './mangled-type-key';

export const serialize = (object: any): string => {
  return JSON.stringify(object, (_, value) => {
    if (value && value[mangledTypeKey]) {
      const props = value.toArray() as Array<any>;
      props.unshift(value[mangledTypeKey]);
      return props;
    }
    return value?.toFixed ? Number(value.toFixed(3)) : value;
  });
};
