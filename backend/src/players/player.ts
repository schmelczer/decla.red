import {
  CommandExecutors,
  CommandReceiver,
  CreateObjectsCommand,
  CreatePlayerCommand,
  DeleteObjectsCommand,
  MoveActionCommand,
  serialize,
  TransportEvents,
  UpdateObjectsCommand,
  StepCommand,
  SetAspectRatioActionCommand,
  calculateViewArea,
} from 'shared';
import { getTimeInMilliseconds } from '../helper/get-time-in-milliseconds';
import { CharacterPhysical } from '../objects/character-physical';

import { BoundingBox } from '../physics/bounding-boxes/bounding-box';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { Physical } from '../physics/physical';

export class Player extends CommandReceiver {
  private character: CharacterPhysical;
  private aspectRatio: number = 16 / 9;
  private isActive = true;

  private objectsPreviouslyInViewArea: Array<Physical> = [];
  private objectsInViewArea: Array<Physical> = [];

  private pingTime?: number;
  private _latency?: number;
  public measureLatency() {
    this.pingTime = getTimeInMilliseconds();
    this.socket.emit(TransportEvents.Ping);
    if (this.isActive) {
      setTimeout(this.measureLatency.bind(this), 10000);
    }
  }

  public get latency(): number | undefined {
    return this._latency;
  }

  protected commandExecutors: CommandExecutors = {
    [StepCommand.type]: this.sendObjects.bind(this),
    [SetAspectRatioActionCommand.type]: (v: SetAspectRatioActionCommand) =>
      (this.aspectRatio = v.aspectRatio),
    [MoveActionCommand.type]: (c: MoveActionCommand) => this.character.sendCommand(c),
  };

  constructor(
    private readonly objects: PhysicalContainer,
    private readonly socket: SocketIO.Socket,
  ) {
    super();
    this.character = new CharacterPhysical(objects);
    this.objectsPreviouslyInViewArea.push(this.character);
    this.objectsInViewArea.push(this.character);

    this.objects.addObject(this.character);

    socket.emit(
      TransportEvents.ServerToPlayer,
      serialize(new CreatePlayerCommand(this.character)),
    );

    socket.on(
      TransportEvents.Pong,
      () => (this._latency = getTimeInMilliseconds() - this.pingTime!),
    );

    this.measureLatency();

    this.sendObjects();
  }

  public sendObjects() {
    const viewArea = calculateViewArea(this.character.center, this.aspectRatio, 1.5);
    const bb = new BoundingBox();
    bb.topLeft = viewArea.topLeft;
    bb.size = viewArea.size;

    this.objectsInViewArea = this.objects.findIntersecting(bb);

    const newlyIntersecting = this.objectsInViewArea.filter(
      (o) => !this.objectsPreviouslyInViewArea.includes(o),
    );

    const noLongerIntersecting = this.objectsPreviouslyInViewArea.filter(
      (o) => !this.objectsInViewArea.includes(o),
    );
    this.objectsPreviouslyInViewArea = this.objectsInViewArea;

    if (noLongerIntersecting.length > 0) {
      this.socket.emit(
        TransportEvents.ServerToPlayer,
        serialize(
          new DeleteObjectsCommand([
            ...new Set(noLongerIntersecting.map((p) => p.gameObject.id)),
          ]),
        ),
      );
    }

    if (newlyIntersecting.length > 0) {
      this.socket.emit(
        TransportEvents.ServerToPlayer,
        serialize(
          new CreateObjectsCommand([
            ...new Set(newlyIntersecting.map((p) => p.gameObject)),
          ]),
        ),
      );
    }

    this.socket.emit(
      TransportEvents.ServerToPlayer,
      serialize(
        new UpdateObjectsCommand([
          ...new Set(
            this.objectsInViewArea.filter((p) => p.canMove).map((p) => p.gameObject),
          ),
        ]),
      ),
    );
  }

  public destroy() {
    this.isActive = false;
    this.character.destroy();
    this.objects.removeObject(this.character);
  }
}
