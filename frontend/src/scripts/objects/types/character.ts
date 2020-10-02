import { vec2 } from 'gl-matrix';
import { Flashlight } from 'sdf-2d';
import { RenderCommand } from '../../graphics/commands/render';
import { rgb } from '../../helper/rgb';
import { IGame } from '../../i-game';
import { KeyDownCommand } from '../../input/commands/key-down';
import { KeyUpCommand } from '../../input/commands/key-up';
import { SwipeCommand } from '../../input/commands/swipe';
import { BoundingBoxBase } from '../../physics/bounds/bounding-box-base';
import { BoundingCircle } from '../../physics/bounds/bounding-circle';
import { StepCommand } from '../../physics/commands/step';
import { TeleportToCommand } from '../../physics/commands/teleport-to';
import { DynamicPhysicalObject } from '../../physics/dynamic-physical-object';
import { Physics } from '../../physics/physics';
import { BlobShape } from '../../shapes/types/blob-shape';

export class Character extends DynamicPhysicalObject {
  protected head: BoundingCircle;
  protected leftFoot: BoundingCircle;
  protected rightFoot: BoundingCircle;

  private keysDown: Set<string> = new Set();

  private light = new Flashlight(
    vec2.fromValues(0, 0),
    rgb(1, 0.6, 0.45),
    0.5,
    vec2.fromValues(-1, 0)
  );

  private shape = new BlobShape();
  private boundingCircle = new BoundingCircle(this, vec2.create(), 50);
  private center = vec2.create();
  private static speed = 1.5;

  constructor(physics: Physics, private game: IGame) {
    super(physics, true);

    this.addCommandExecutor(RenderCommand, this.draw.bind(this));
    this.addCommandExecutor(TeleportToCommand, (c) => this.setPosition(c.position));
    this.addCommandExecutor(KeyDownCommand, (c) => this.keysDown.add(c.key));
    this.addCommandExecutor(KeyUpCommand, (c) => this.keysDown.delete(c.key));
    this.addCommandExecutor(StepCommand, this.stepHandler.bind(this));
    this.addCommandExecutor(SwipeCommand, (c) => {
      this.tryMoving(vec2.multiply(vec2.create(), c.delta, this.game.viewArea.size));
    });

    this.head = new BoundingCircle(this, this.center, 50);
    this.leftFoot = new BoundingCircle(this, this.center, 50);
    this.rightFoot = new BoundingCircle(this, this.center, 50);

    this.shape.setCircles([this.head, this.leftFoot, this.rightFoot]);

    this.addToPhysics();
  }

  public distance(target: vec2): number {
    return this.shape.minDistance(target);
  }

  private draw(c: RenderCommand) {
    c.renderer.addDrawable(this.shape);
    c.renderer.addDrawable(this.light);
  }

  public get position(): vec2 {
    return this.center;
  }

  public getBoundingCircles(): Array<BoundingCircle> {
    return [this.boundingCircle];
  }

  public getBoundingBox(): BoundingBoxBase {
    return this.head.boundingBox;
  }

  private tryMoving(delta: vec2) {
    this.physics.tryMovingDynamicCircle(this.head, delta);
  }

  private setPosition(value: vec2) {
    //this.head.center = value;
    this.light.center = vec2.add(vec2.create(), value, vec2.fromValues(50, -40));
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
