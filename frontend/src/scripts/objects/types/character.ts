import { vec2 } from 'gl-matrix';
import { GameObject } from '../game-object';
import { Camera } from './camera';
import { StepCommand } from '../../physics/commands/step';
import { KeyDownCommand } from '../../input/commands/key-down';
import { KeyUpCommand } from '../../input/commands/key-up';
import { SwipeCommand } from '../../input/commands/swipe';
import { MoveToCommand } from '../../physics/commands/move-to';

export class Character extends GameObject {
  private keysDown: Set<string> = new Set();

  private static speed = 0.5;

  constructor(private camera: Camera) {
    super();

    this.addCommandExecutor(StepCommand, this.stepHandler.bind(this));
    this.addCommandExecutor(KeyDownCommand, (c) => this.keysDown.add(c.key));
    this.addCommandExecutor(KeyUpCommand, (c) => this.keysDown.delete(c.key));
    this.addCommandExecutor(SwipeCommand, (c) =>
      this.setPosition(
        vec2.add(
          vec2.create(),
          this.position,
          vec2.multiply(vec2.create(), c.delta, this.camera.boundingBoxSize)
        )
      )
    );
  }

  private setPosition(value: vec2) {
    this._position = value;
    this.camera.sendCommand(new MoveToCommand(this.position));
  }

  public stepHandler(c: StepCommand) {
    const deltaTime = c.deltaTimeInMiliseconds;

    const up = ~~this.keysDown.has('w');
    const down = ~~this.keysDown.has('s');
    const left = ~~this.keysDown.has('a');
    const right = ~~this.keysDown.has('d');

    const movementVector = vec2.fromValues(right - left, up - down);
    if (movementVector.length > 0) {
      this.setPosition(
        vec2.add(
          vec2.create(),
          this.position,
          vec2.scale(
            vec2.create(),
            vec2.normalize(movementVector, movementVector),
            Character.speed * deltaTime
          )
        )
      );
    }
  }
}
