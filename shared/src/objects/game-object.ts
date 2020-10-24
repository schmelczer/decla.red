import { Id } from '../transport/identity';
import { serializable } from '../transport/serialization/serializable';

@serializable
export class RemoteCall {
  constructor(public readonly functionName: string, public readonly args: Array<any>) {}

  public toArray(): Array<any> {
    return [this.functionName, this.args];
  }
}

export abstract class GameObject {
  private remoteCalls: Array<RemoteCall> = [];

  constructor(public readonly id: Id) {}

  public processRemoteCalls(remoteCalls: Array<RemoteCall>) {
    remoteCalls.forEach((r) =>
      ((this[r.functionName as keyof this] as unknown) as (
        ...args: Array<any>
      ) => unknown)(...r.args),
    );
  }

  public getRemoteCalls(): Array<RemoteCall> {
    return this.remoteCalls;
  }

  public resetRemoteCalls() {
    this.remoteCalls = [];
  }

  protected remoteCall(name: string & keyof this, ...args: Array<any>) {
    this.remoteCalls.push(new RemoteCall(name, args));
  }
}
