import { vec2 } from 'gl-matrix';
import { Circle } from '../../shapes/types/circle';
import { KeyDownCommand } from '../../input/commands/key-down';
import { KeyUpCommand } from '../../input/commands/key-up';
import { SwipeCommand } from '../../input/commands/swipe';
import { MoveToCommand } from '../../physics/commands/move-to';
import { StepCommand } from '../../physics/commands/step';
import { TeleportToCommand } from '../../physics/commands/teleport-to';
import { Physics } from '../../physics/physics';
import { GameObject } from '../game-object';
import { Camera } from './camera';
import { IShape } from '../../shapes/i-shape';
import { rotate90Deg } from '../../helper/rotate-90-deg';
import { max } from 'gl-matrix/src/gl-matrix/vec2';

export class Character extends GameObject {
  private keysDown: Set<string> = new Set();

  private shape: Circle;
  private static speed = 1.5;

  constructor(private physics: Physics, private camera: Camera) {
    super();

    this.shape = new Circle();
    this.shape.radius = 80;

    this.addCommandExecutor(StepCommand, this.stepHandler.bind(this));
    this.addCommandExecutor(TeleportToCommand, (c) =>
      this.setPosition(c.position)
    );
    this.addCommandExecutor(KeyDownCommand, (c) => this.keysDown.add(c.key));
    this.addCommandExecutor(KeyUpCommand, (c) => this.keysDown.delete(c.key));
    this.addCommandExecutor(SwipeCommand, (c) => {
      this.tryMoving(
        vec2.multiply(vec2.create(), c.delta, this.camera.viewAreaSize)
      );
    });
  }

  private tryMoving(delta: vec2, isFirstIteration = true) {
    const maxStep = 2;
    if (vec2.length(delta) > maxStep) {
      let steppedDelta = vec2.normalize(vec2.create(), delta);
      vec2.scale(steppedDelta, steppedDelta, maxStep - 0.001);

      for (let i = 0; i <= vec2.length(delta) / maxStep - 1; i++) {
        this.tryMoving(vec2.clone(steppedDelta), isFirstIteration);
      }

      steppedDelta = vec2.normalize(vec2.create(), delta);

      vec2.scale(steppedDelta, steppedDelta, vec2.length(delta) % maxStep);
      this.tryMoving(vec2.clone(steppedDelta), isFirstIteration);

      return;
    }

    const nextShape = this.shape.clone();
    vec2.add(nextShape.center, nextShape.center, delta);

    const nextNearShapes = this.getNearShapesTo(nextShape);

    if (nextNearShapes.length && nextNearShapes[0].distance < 0) {
      this.setPosition(nextShape.center);
    } else {
      if (!isFirstIteration) {
        return;
      }

      const currentNearShapes = this.getNearShapesTo(this.shape);
      const intersecting = nextNearShapes
        .filter(
          (n) =>
            currentNearShapes.find(
              (c) => c.shape === n.shape && c.distance <= 0
            ) !== undefined
        )
        .sort((e) => Math.abs(e.distance));

      const normal = intersecting[0].shape.normal(this.shape.center);

      const maxDistance = intersecting.reduce((p, c) =>
        p.distance > c.distance ? p : c
      ).distance;

      vec2.add(
        delta,
        delta,
        vec2.scale(vec2.create(), normal, -maxDistance - 2)
      );

      this.tryMoving(delta, false);
    }
  }

  private getNearShapesTo(
    shape: Circle
  ): Array<{ shape: IShape; distance: number }> {
    return this.physics
      .findIntersecting(shape.boundingBox)
      .filter((b) => b.shape)
      .map((b) => ({
        shape: b.shape,
        distance: b.shape.distance(shape.center) + shape.radius,
      }))
      .sort((e) => e.distance);
  }

  private setPosition(value: vec2) {
    this.shape.center = value;
    this.camera.sendCommand(new MoveToCommand(this.shape.center));
  }

  public stepHandler(c: StepCommand) {
    const deltaTime = c.deltaTimeInMiliseconds;
    const up = ~~(this.keysDown.has('w') || this.keysDown.has('arrowup'));
    const down = ~~(this.keysDown.has('s') || this.keysDown.has('arrowdown'));
    const left = ~~(this.keysDown.has('a') || this.keysDown.has('arrowleft'));
    const right = ~~(this.keysDown.has('d') || this.keysDown.has('arrowright'));

    const movementVector = vec2.fromValues(right - left, up - down);
    if (vec2.length(movementVector) > 0) {
      vec2.normalize(movementVector, movementVector);
      vec2.scale(movementVector, movementVector, Character.speed * deltaTime);

      this.tryMoving(movementVector);
    }
  }
}
