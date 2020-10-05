/**
 * static type: string must be implemented
 * @param constructor
 */
export const typed = <T extends { new (...args: any[]): {} }>(constructor: T) => {
  return class extends constructor {
    public get type(): string {
      return (this as any).constructor.type;
    }
  };
};
