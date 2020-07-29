export abstract class Typed {
  public abstract get type(): string;

  public toJSON() {
    return { type: this.type, ...this };
  }
}
