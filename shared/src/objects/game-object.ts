import { Command } from '../commands/command';
import { CommandReceiver } from '../commands/command-receiver';
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

// Wire property keys — compiler-checked at both the producing (server) and
// consuming (client) ends; wire strings are unchanged.
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

let currentUpdateGeneration = 0;
export const beginPropertyUpdateGeneration = (): void => {
  currentUpdateGeneration++;
};

export abstract class GameObject extends CommandReceiver {
  private remoteCalls: Array<RemoteCall> = [];
  private updateGeneration = -1;
  private cachedPropertyUpdates?: PropertyUpdatesForObject;

  // Security: processRemoteCalls dispatches by a raw string off the network.
  // Keep this allow-list in sync with the remoteCall() emitters on *-physical.
  private static readonly allowedRemoteCalls: ReadonlySet<string> = new Set([
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

  constructor(public readonly id: Id) {
    super();
  }

  public processRemoteCalls(remoteCalls: Array<RemoteCall>) {
    remoteCalls.forEach((r) => {
      if (!GameObject.allowedRemoteCalls.has(r.functionName)) {
        console.warn(`Dropped disallowed remote call: ${r.functionName}`);
        return;
      }
      const fn = this[r.functionName as keyof this];
      if (typeof fn === 'function') {
        (fn as (...args: Array<any>) => unknown).apply(this, r.args);
      }
    });
  }

  public getPropertyUpdates(): PropertyUpdatesForObject | undefined {
    return undefined;
  }

  public getPropertyUpdatesForFrame(): PropertyUpdatesForObject | undefined {
    if (this.updateGeneration !== currentUpdateGeneration) {
      this.updateGeneration = currentUpdateGeneration;
      this.cachedPropertyUpdates = this.getPropertyUpdates();
    }
    return this.cachedPropertyUpdates;
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
