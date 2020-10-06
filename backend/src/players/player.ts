import { vec2 } from 'gl-matrix';
import {
  Command,
  CommandExecutors,
  CommandReceiver,
  CreateObjectsCommand,
  CreatePlayerCommand,
  DeleteObjectsCommand,
  MoveActionCommand,
  SetViewAreaActionCommand,
  TransportEvents,
  UpdateObjectsCommand,
} from 'shared';
import { CharacterPhysical } from '../objects/character-physical';

import { BoundingBox } from '../physics/bounding-boxes/bounding-box';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { Physical } from '../physics/physical';
import { jsonSerialize } from '../serialize';

export class Player extends CommandReceiver {
  public isActive = true;

  private character: CharacterPhysical;

  private objectsPreviouslyInViewArea: Array<Physical> = [];
  private objectsInViewArea: Array<Physical> = [];

  protected commandExecutors: CommandExecutors = {
    [SetViewAreaActionCommand.type]: this.setViewArea.bind(this),
    [MoveActionCommand.type]: (c: MoveActionCommand) => {
      vec2.normalize(c.delta, c.delta);
      vec2.scale(c.delta, c.delta, 15);
      this.character.sendCommand(c);
    },
  };

  protected defaultCommandExecutor(command: Command) {}

  constructor(
    private readonly objects: PhysicalContainer,
    private readonly socket: SocketIO.Socket
  ) {
    super();
    this.character = new CharacterPhysical(objects);
    this.objectsPreviouslyInViewArea.push(this.character);
    this.objectsInViewArea.push(this.character);

    this.objects.addObject(this.character);

    socket.emit(
      TransportEvents.ServerToPlayer,
      jsonSerialize(new CreatePlayerCommand(jsonSerialize(this.character)))
    );

    this.sendObjects();
  }

  public setViewArea(c: SetViewAreaActionCommand) {
    const viewArea = new BoundingBox(null);
    viewArea.topLeft = c.viewArea.topLeft;
    viewArea.size = c.viewArea.size;

    this.objectsInViewArea = this.objects.findIntersecting(viewArea);
  }

  public sendObjects() {
    const newlyIntersecting = this.objectsInViewArea.filter(
      (o) => !this.objectsPreviouslyInViewArea.includes(o)
    );

    const noLongerIntersecting = this.objectsPreviouslyInViewArea.filter(
      (o) => !this.objectsInViewArea.includes(o)
    );

    this.objectsPreviouslyInViewArea = this.objectsInViewArea;

    if (noLongerIntersecting.length > 0) {
      this.socket.emit(
        TransportEvents.ServerToPlayer,
        jsonSerialize(
          new DeleteObjectsCommand([
            ...new Set(noLongerIntersecting.map((p) => p.gameObject.id)),
          ])
        )
      );
    }

    if (newlyIntersecting.length > 0) {
      this.socket.emit(
        TransportEvents.ServerToPlayer,
        jsonSerialize(
          new CreateObjectsCommand(
            jsonSerialize([...new Set(newlyIntersecting.map((p) => p.gameObject))])
          )
        )
      );
    }

    this.socket.emit(
      TransportEvents.ServerToPlayer,
      jsonSerialize(
        new UpdateObjectsCommand(
          jsonSerialize([
            ...new Set(
              this.objectsInViewArea.filter((p) => p.canMove).map((p) => p.gameObject)
            ),
          ])
        )
      )
    );

    if (this.isActive) {
      //setImmediate(this.sendObjects.bind(this));
      setTimeout(this.sendObjects.bind(this), 5);
    }
  }

  public destroy() {
    this.isActive = false;
    this.objects.removeObject(this.character);
  }
}
