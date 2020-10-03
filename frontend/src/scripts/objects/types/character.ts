import { vec2 } from 'gl-matrix';
import { Flashlight } from 'sdf-2d';
import { RenderCommand } from '../../commands/render';
import { StepCommand } from '../../commands/step';
import { TeleportToCommand } from '../../commands/teleport-to';
import { rgb } from '../../helper/rgb';
import { IGame } from '../../i-game';
import { CursorMoveCommand } from '../../input/commands/cursor-move-command';
import { KeyDownCommand } from '../../input/commands/key-down';
import { KeyUpCommand } from '../../input/commands/key-up';
import { PrimaryActionCommand } from '../../input/commands/primary-action';
import { SwipeCommand } from '../../input/commands/swipe';
import { BoundingBoxBase } from '../../physics/bounds/bounding-box-base';
import { BoundingCircle } from '../../physics/bounds/bounding-circle';
import { PhysicsCircle } from '../../physics/bounds/physics-circle';
import { DynamicPhysicalObject } from '../../physics/dynamic-physical-object';
import { Physics } from '../../physics/physics';
import { settings } from '../../settings';
import { BlobShape } from '../../shapes/blob-shape';
import { Projectile } from './projectile';

export class Character extends DynamicPhysicalObject {
  protected head: PhysicsCircle;
  protected leftFoot: PhysicsCircle;
  protected rightFoot: PhysicsCircle;

  private keysDown: Set<string> = new Set();

  private flashlight = new Flashlight(
    vec2.create(),
    rgb(1, 0.6, 0.45),
    0.15,
    vec2.fromValues(1, 0),
    50
  );

  private static walkForce = 0.005;
  private static jumpForce = 10;

  private shape = new BlobShape();
  private boundingCircle = new BoundingCircle(this, vec2.create(), 50);

  private readonly headOffset = vec2.fromValues(0, 40);
  private readonly leftFootOffset = vec2.fromValues(-20, -10);
  private readonly rightFootOffset = vec2.fromValues(20, -10);

  constructor(physics: Physics, private game: IGame) {
    super(physics, true);

    this.addCommandExecutor(RenderCommand, this.draw.bind(this));
    this.addCommandExecutor(TeleportToCommand, (c) => this.setPosition(c.position));
    this.addCommandExecutor(KeyDownCommand, (c) => this.keysDown.add(c.key));
    this.addCommandExecutor(KeyUpCommand, (c) => this.keysDown.delete(c.key));
    this.addCommandExecutor(StepCommand, this.stepHandler.bind(this));
    this.addCommandExecutor(CursorMoveCommand, this.directLight.bind(this));
    this.addCommandExecutor(PrimaryActionCommand, this.spawnProjectile.bind(this));
    this.addCommandExecutor(SwipeCommand, (c) => {
      //this.tryMoving(vec2.multiply(vec2.create(), c.delta, this.game.viewArea.size));
    });

    this.head = new PhysicsCircle(physics, this, vec2.clone(this.headOffset), 50);
    this.leftFoot = new PhysicsCircle(physics, this, vec2.clone(this.leftFootOffset), 20);
    this.rightFoot = new PhysicsCircle(
      physics,
      this,
      vec2.clone(this.rightFootOffset),
      20
    );

    this.shape.setCircles([this.head, this.leftFoot, this.rightFoot]);

    this.addToPhysics();
  }

  public distance(target: vec2): number {
    return this.shape.minDistance(target);
  }

  private draw(c: RenderCommand) {
    c.renderer.addDrawable(this.shape);
    c.renderer.addDrawable(this.flashlight);
  }

  private directLight(e: CursorMoveCommand) {
    const pos = this.game.displayToWorldCoordinates(e.position);
    vec2.sub(pos, pos, this.head.center);
    this.flashlight.direction = pos;
  }

  private spawnProjectile(e: PrimaryActionCommand) {
    const pos = this.game.displayToWorldCoordinates(e.position);
    const direction = vec2.sub(vec2.create(), pos, this.head.center);
    vec2.normalize(direction, direction);
    const start = vec2.add(
      vec2.create(),
      this.head.center,
      vec2.scale(vec2.create(), direction, this.head.radius)
    );

    vec2.scale(direction, direction, 5);

    const projectile = new Projectile(this.game, this.physics, start, direction);
    this.game.addObject(projectile);
  }

  public get position(): vec2 {
    return this.head.center;
  }

  public getBoundingCircles(): Array<BoundingCircle> {
    return [this.boundingCircle];
  }

  public getBoundingBox(): BoundingBoxBase {
    return this.head.boundingBox;
  }

  private setPosition(value: vec2) {
    this.head.center = vec2.clone(value);
    this.leftFoot.center = vec2.clone(value);
    this.rightFoot.center = vec2.clone(value);
  }

  public stepHandler(c: StepCommand) {
    const deltaTime = c.deltaTimeInMiliseconds;

    const isAirborne = this.leftFoot.isAirborne && this.rightFoot.isAirborne;
    const up =
      ~~(
        !isAirborne &&
        (this.keysDown.has('w') || this.keysDown.has('arrowup') || this.keysDown.has(' '))
      ) * Character.jumpForce;
    const down = ~~(
      !isAirborne &&
      (this.keysDown.has('s') || this.keysDown.has('arrowdown'))
    );
    const left =
      ~~(this.keysDown.has('a') || this.keysDown.has('arrowleft')) *
      Character.walkForce *
      deltaTime;
    const right =
      ~~(this.keysDown.has('d') || this.keysDown.has('arrowright')) *
      Character.walkForce *
      deltaTime;

    const movementForce = vec2.fromValues(right - left, up - down);
    this.head.applyForce(movementForce, deltaTime);
    this.head.applyForce(settings.gravitationalForce, deltaTime);

    const bodyCenter = vec2.sub(vec2.create(), this.head.center, this.headOffset);

    const leftFootPositon = vec2.add(vec2.create(), bodyCenter, this.leftFootOffset);
    const rightFootPositon = vec2.add(vec2.create(), bodyCenter, this.rightFootOffset);

    const leftFootDelta = vec2.sub(vec2.create(), this.leftFoot.center, leftFootPositon);
    const rightFootDelta = vec2.sub(
      vec2.create(),
      this.rightFoot.center,
      rightFootPositon
    );

    vec2.scale(leftFootDelta, leftFootDelta, 0.0006);
    vec2.scale(rightFootDelta, rightFootDelta, 0.0006);

    this.head.applyForce(leftFootDelta, deltaTime);
    this.head.applyForce(rightFootDelta, deltaTime);

    vec2.scale(leftFootDelta, leftFootDelta, -0.5);
    vec2.scale(rightFootDelta, rightFootDelta, -0.5);

    this.leftFoot.applyForce(movementForce, deltaTime);
    this.rightFoot.applyForce(movementForce, deltaTime);
    this.leftFoot.applyForce(leftFootDelta, deltaTime);
    this.rightFoot.applyForce(rightFootDelta, deltaTime);
    this.leftFoot.applyForce(settings.gravitationalForce, deltaTime);
    this.rightFoot.applyForce(settings.gravitationalForce, deltaTime);

    this.head.step(deltaTime);
    this.leftFoot.step(deltaTime);
    this.rightFoot.step(deltaTime);

    this.flashlight.center = vec2.add(
      vec2.create(),
      this.head.center,
      vec2.fromValues(0, 0)
    );
  }
}
