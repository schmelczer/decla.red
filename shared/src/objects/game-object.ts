import { Command } from '../commands/command';
import { Id } from '../communication/communication';
import { serializable } from '../serialization/serializable';

@serializable
export class RemoteCall {
  constructor(
    public readonly functionName: string,
    public readonly args: Array<any>,
  ) {}

  public toArray(): Array<any> {
    return [this.functionName, this.args];
  }
}

export type SyncPropertyKey =
  | 'head'
  | 'leftFoot'
  | 'rightFoot'
  | 'strength'
  | 'center'
  | 'ownership'
  | 'rotation';

@serializable
export class UpdatePropertyCommand extends Command {
  constructor(
    public readonly propertyKey: SyncPropertyKey,
    public readonly propertyValue: any,
    public readonly rateOfChange: any,
  ) {
    super();
  }

  public toArray(): Array<any> {
    return [this.propertyKey, this.propertyValue, this.rateOfChange];
  }
}

@serializable
export class PropertyUpdatesForObject {
  constructor(
    public readonly id: Id,
    public readonly updates: Array<UpdatePropertyCommand>,
  ) {}

  public toArray(): Array<any> {
    return [this.id, this.updates];
  }
}

// Security: remote calls are dispatched by a raw string off the network.
const allowedRemoteCalls: ReadonlySet<string> = new Set([
  'onShoot',
  'onLeap',
  'onDie',
  'onHitConfirmed',
  'onKillConfirmed',
  'setHealth',
  'setKillCount',
  'onFlipped',
  'setContested',
  'generatedPoints',
  'setLight',
]);

export abstract class GameObject {
  private remoteCalls: Array<RemoteCall> = [];

  constructor(public readonly id: Id) {}

  public processRemoteCalls(remoteCalls: Array<RemoteCall>) {
    for (const { functionName, args } of remoteCalls) {
      if (!allowedRemoteCalls.has(functionName)) {
        console.warn(`Dropped disallowed remote call: ${functionName}`);
        continue;
      }
      const fn = this[functionName as keyof this];
      if (typeof fn === 'function') {
        (fn as (...args: Array<any>) => unknown).apply(this, args);
      }
    }
  }

  public getPropertyUpdates(): PropertyUpdatesForObject | undefined {
    return undefined;
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
