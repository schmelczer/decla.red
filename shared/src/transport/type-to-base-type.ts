export const typeToBaseType = <T extends { new(...args: any[]): {} }>(
  constructor: T
) => {
  const parent = constructor;
  return class extends constructor {
    public static get type(): string {
      return Object.getPrototypeOf((parent as any).prototype).constructor.name;
    }

    public get type(): string {
      return Object.getPrototypeOf((parent as any).prototype).constructor.name;
    }
  };
};
