import { vec2, vec3 } from 'gl-matrix';
import { RenderCommand } from '../../drawing/commands/render';
import { DrawableBlob } from '../../drawing/drawables/drawable-blob';
import { CircleLight } from '../../drawing/drawables/lights/circle-light';
import { IGame } from '../../i-game';
import { KeyDownCommand } from '../../input/commands/key-down';
import { KeyUpCommand } from '../../input/commands/key-up';
import { SwipeCommand } from '../../input/commands/swipe';
import { StepCommand } from '../../physics/commands/step';
import { TeleportToCommand } from '../../physics/commands/teleport-to';
import { IShape } from '../../shapes/i-shape';
import { Blob } from '../../shapes/types/blob';
import { GameObject } from '../game-object';

export class Character extends GameObject {
  private keysDown: Set<string> = new Set();
  private light: CircleLight;
  private shape = new DrawableBlob(vec2.create());
  private static speed = 4.5;

  constructor(private game: IGame) {
    super();

    this.light = new CircleLight(vec2.create(), 30, vec3.fromValues(0.67, 0.0, 0.33), 2);

    this.addCommandExecutor(StepCommand, this.stepHandler.bind(this));
    this.addCommandExecutor(RenderCommand, this.draw.bind(this));
    this.addCommandExecutor(TeleportToCommand, (c) => this.setPosition(c.position));
    this.addCommandExecutor(KeyDownCommand, (c) => this.keysDown.add(c.key));
    this.addCommandExecutor(KeyUpCommand, (c) => this.keysDown.delete(c.key));
    this.addCommandExecutor(SwipeCommand, (c) => {
      this.tryMoving(vec2.multiply(vec2.create(), c.delta, this.game.viewArea.size));
    });
  }

  public get position(): vec2 {
    return this.shape.center;
  }

  private draw(c: RenderCommand) {
    c.renderer.drawShape(this.shape);
    c.renderer.drawLight(this.light);
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
            currentNearShapes.find((c) => c.shape === n.shape && c.distance <= 0) !==
            undefined
        )
        .sort((e) => Math.abs(e.distance));

      if (intersecting.length < 1) {
        return;
      }
      const normal = intersecting[0].shape.normal(this.shape.center);

      const maxDistance = intersecting.reduce((p, c) => (p.distance > c.distance ? p : c))
        .distance;

      vec2.add(delta, delta, vec2.scale(vec2.create(), normal, -maxDistance - 2));

      this.tryMoving(delta, false);
    }
  }

  private getNearShapesTo(shape: Blob): Array<{ shape: IShape; distance: number }> {
    return this.game
      .findIntersecting(shape.boundingBox)
      .filter((b) => b.shape)
      .map((b) => ({
        shape: b.shape,
        // TODO: fix this
        distance: b.shape.distance(shape.center) + shape.radius - 20,
      }))
      .sort((e) => e.distance);
  }

  private setPosition(value: vec2) {
    this.shape.position = value;
    this.light.center = vec2.add(vec2.create(), value, vec2.fromValues(150, 0));
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
