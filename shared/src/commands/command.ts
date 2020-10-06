export abstract class Command {
  public static get type(): string {
    return (this as any).name;
  }

  public get type(): string {
    return (this as any).constructor.name;
  }
}
