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
import { CharacterPhysics } from '../objects/character-physics';
import { CirclePhysics } from '../objects/circle-physics';

import { BoundingBox } from '../physics/bounds/bounding-box';
import { PhysicalGameObject } from '../physics/physical-game-object';
import { PhysicalGameObjectContainer } from '../physics/physical-game-object-container';
import { jsonSerialize } from '../serialize';

export class Player extends CommandReceiver {
  public isActive = true;

  private character: CharacterPhysics = new CharacterPhysics(
    new CirclePhysics(vec2.fromValues(50, 50), 50),
    new CirclePhysics(vec2.fromValues(50, 50), 50),
    new CirclePhysics(vec2.fromValues(50, 50), 50)
  );

  private objectsPreviouslyInViewArea: Array<PhysicalGameObject> = [];
  private objectsInViewArea: Array<PhysicalGameObject> = [];

  protected commandExecutors: CommandExecutors = {
    [SetViewAreaActionCommand.type]: this.setViewArea.bind(this),
    [MoveActionCommand.type]: (c: MoveActionCommand) => {
      vec2.normalize(c.delta, c.delta);
      vec2.scale(c.delta, c.delta, 40);
      this.character.head.center = vec2.add(
        this.character.head.center,
        this.character.head.center,
        c.delta
      );
    },
  };

  protected defaultCommandExecutor(command: Command) {}

  constructor(
    private readonly objects: PhysicalGameObjectContainer,
    private readonly socket: SocketIO.Socket
  ) {
    super();
    this.objectsPreviouslyInViewArea.push(this.character);
    this.objectsInViewArea.push(this.character);

    this.objects.addObject(this.character, true);

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
        jsonSerialize(new DeleteObjectsCommand(noLongerIntersecting.map((o) => o.id)))
      );
    }

    if (newlyIntersecting.length > 0) {
      this.socket.emit(
        TransportEvents.ServerToPlayer,
        jsonSerialize(new CreateObjectsCommand(jsonSerialize(newlyIntersecting)))
      );
    }

    this.socket.emit(
      TransportEvents.ServerToPlayer,
      jsonSerialize(
        new UpdateObjectsCommand(
          jsonSerialize(this.objectsInViewArea.filter((o) => o.canMove))
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
