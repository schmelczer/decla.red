import { Command } from '../commands/command';
import { CommandReceiver } from '../commands/command-receiver';
import { Id } from '../communication/id';
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

// Every object property streamed via UpdatePropertyCommand. A single union means
// a typo or rename on the producing (server *-physical) or consuming (client
// *-view) side is a compile error instead of a silently dropped update that
// just stops a body interpolating. The wire format is unchanged — these remain
// the same strings, only now compiler-checked at both ends.
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

export abstract class GameObject extends CommandReceiver {
  private remoteCalls: Array<RemoteCall> = [];

  // The only methods a peer may invoke over the wire. processRemoteCalls
  // dispatches by a raw string taken straight off the network, so without this
  // gate a malformed or hostile packet could call ANY method on the object
  // (toArray, resetRemoteCalls, even prototype methods). Keep in sync with the
  // remoteCall() emitters on the *-physical classes.
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
