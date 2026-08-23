export abstract class Command {
  public static get type(): string {
    return this.name;
  }

  public get type(): string {
    return this.constructor.name;
  }
}
