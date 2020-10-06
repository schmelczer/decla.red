export abstract class Typed {
  public static get type(): string {
    return (this as any).name;
  }

  public get type(): string {
    return (this as any).constructor.name;
  }
}
