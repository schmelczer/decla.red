import { vec2 } from 'gl-matrix';
import { Circle } from '../../drawing/drawables/primitives/circle';
import { KeyDownCommand } from '../../input/commands/key-down';
import { KeyUpCommand } from '../../input/commands/key-up';
import { SwipeCommand } from '../../input/commands/swipe';
import { MoveToCommand } from '../../physics/commands/move-to';
import { StepCommand } from '../../physics/commands/step';
import { TeleportToCommand } from '../../physics/commands/teleport-to';
import { Physics } from '../../physics/physics';
import { GameObject } from '../game-object';
import { Camera } from './camera';

export class Character extends GameObject {
  private keysDown: Set<string> = new Set();

  private primitive: Circle;
  private static speed = 1.5;

  constructor(private physics: Physics, private camera: Camera) {
    super();

    this.primitive = new Circle(this);
    this.primitive.radius = 40;

    this.addCommandExecutor(StepCommand, this.stepHandler.bind(this));
    this.addCommandExecutor(TeleportToCommand, (c) =>
      this.setPosition(c.position)
    );
    this.addCommandExecutor(KeyDownCommand, (c) => this.keysDown.add(c.key));
    this.addCommandExecutor(KeyUpCommand, (c) => this.keysDown.delete(c.key));
    this.addCommandExecutor(SwipeCommand, (c) =>
      this.checkAndSetPosition(
        vec2.add(
          vec2.create(),
          this.primitive.center,
          vec2.multiply(vec2.create(), c.delta, this.camera.viewAreaSize)
        )
      )
    );
  }

  private checkAndSetPosition(value: vec2) {
    const nextPrimitive = this.primitive.clone();
    nextPrimitive.center = value;

    if (
      this.physics
        .findIntersecting(nextPrimitive.boundingBox)
        .filter((b) => b.value)
        .map(
          (b) => b.value.distance(nextPrimitive.center) + nextPrimitive.radius
        )
        .find((d) => d < 0) !== undefined
    ) {
      this.setPosition(value);
    }
  }

  private setPosition(value: vec2) {
    // console.log('character', value);

    this.primitive.center = value;
    this.camera.sendCommand(new MoveToCommand(this.primitive.center));
  }

  public stepHandler(c: StepCommand) {
    const deltaTime = c.deltaTimeInMiliseconds;

    const up = ~~this.keysDown.has('w');
    const down = ~~this.keysDown.has('s');
    const left = ~~this.keysDown.has('a');
    const right = ~~this.keysDown.has('d');

    const movementVector = vec2.fromValues(right - left, up - down);
    if (movementVector.length > 0) {
      vec2.normalize(movementVector, movementVector);
      vec2.scale(movementVector, movementVector, Character.speed * deltaTime);

      this.checkAndSetPosition(
        vec2.add(vec2.create(), this.primitive.center, movementVector)
      );
    }
  }
}
