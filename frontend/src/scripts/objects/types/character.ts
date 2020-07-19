import { GameObject } from '../game-object';
import { Vec2 } from '../../math/vec2';
import { ObjectContainer } from '../object-container';
import { Camera } from './camera';
import { MoveToCommand } from '../../commands/types/move-to';
import { StepCommand } from '../../commands/types/step';
import { KeyDownCommand } from '../../commands/types/key-down';
import { KeyUpCommand } from '../../commands/types/key-up';
import { SwipeCommand } from '../../commands/types/swipe';

export class Character extends GameObject {
  private keysDown: Set<string> = new Set();
  private camera = new Camera();

  private static speed = 0.5;

  constructor(objects: ObjectContainer) {
    super();

    objects.addObject(this.camera);
    this.addCommandExecutor(StepCommand, this.stepHandler.bind(this));
    this.addCommandExecutor(KeyDownCommand, (c) => this.keysDown.add(c.key));
    this.addCommandExecutor(KeyUpCommand, (c) => this.keysDown.delete(c.key));
    this.addCommandExecutor(SwipeCommand, (c) =>
      this.setPosition(
        this.position.add(c.delta.times(this.camera.boundingBoxSize))
      )
    );
  }

  private setPosition(value: Vec2) {
    this._position = value;
    this.camera.sendCommand(new MoveToCommand(this.position));
  }

  public stepHandler(c: StepCommand) {
    const deltaTime = c.deltaTimeInMiliseconds;

    const up = ~~this.keysDown.has('w');
    const down = ~~this.keysDown.has('s');
    const left = ~~this.keysDown.has('a');
    const right = ~~this.keysDown.has('d');

    const movementVector = new Vec2(right - left, up - down);
    if (movementVector.length > 0) {
      this.setPosition(
        this.position.add(
          movementVector.normalized.scale(Character.speed * deltaTime)
        )
      );
    }
  }
}
