export class Typed {
  public get type(): string {
    return this.constructor.name;
  }

  public toJSON() {
    return { type: this.type, ...this };
  }
}
