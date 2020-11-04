import { Command } from '../commands/command';
import { Id } from '../communication/id';
import { serializable } from '../serialization/serializable';

@serializable
export class RemoteCall {
  constructor(public readonly functionName: string, public readonly args: Array<any>) {}

  public toArray(): Array<any> {
    return [this.functionName, this.args];
  }
}

@serializable
export class UpdateProperty {
  constructor(
    public readonly propertyKey: string,
    public readonly propertyValue: any,
    public readonly rateOfChange: any,
  ) {}

  public toArray(): Array<any> {
    return [this.propertyKey, this.propertyValue, this.rateOfChange];
  }
}

@serializable
export class PropertyUpdatesForObject {
  constructor(public readonly id: Id, public readonly updates: Array<UpdateProperty>) {}

  public toArray(): Array<any> {
    return [this.id, this.updates];
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

  public getPropertyUpdates(): PropertyUpdatesForObject | void {}

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
