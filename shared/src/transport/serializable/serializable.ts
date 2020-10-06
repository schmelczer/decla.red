export const serializableClasses = new Map<
  string,
  {
    constructor: any;
    overriden: boolean;
  }
>();

export const serializable = (serializableType?) => {
  return (type): any => {
    const actualType = serializableType
      ? Object.getPrototypeOf((serializableType as any).prototype).constructor
      : type;

    const typeName = actualType.name;

    const overridableConstructor = serializableClasses.get(typeName);
    if (!overridableConstructor) {
      serializableClasses.set(typeName, {
        constructor: actualType,
        overriden: false,
      });
    }

    if (!Object.prototype.hasOwnProperty.call(actualType.prototype, 'toArray')) {
      throw new Error(
        `Class ${typeName} must define a toArray returning an array containing the arguments for its constructor.`
      );
    }

    return class extends type {
      public get type(): string {
        return typeName;
      }

      public static get type(): string {
        return typeName;
      }
    };
  };
};

export const deserializable = (fromType) => {
  return (type): any => {
    const overridableConstructor = serializableClasses.get(fromType.name);
    if (!overridableConstructor || !overridableConstructor.overriden) {
      serializableClasses.set(fromType.name, {
        constructor: type,
        overriden: true,
      });
    } else {
      throw new Error(
        `Constructor  ${fromType} already overriden, cannot override again with ${type}`
      );
    }
    return type;
  };
};
