/*import { vec2 } from 'gl-matrix';
import { Circle } from 'sdf-2d';
import { RenderCommand } from '../../commands/render';
import { StepCommand } from '../../commands/step';
import { IGame } from '../../i-game';
import { BoundingBoxBase } from '../../physics/bounds/bounding-box-base';
import { BoundingCircle } from '../../physics/bounds/bounding-circle';
import { PhysicsCircle } from '../../physics/bounds/physics-circle';
import { PhysicalGameObject } from '../../physics/physical-object';
import { Physics } from '../../physics/physics';
import { settings } from '../../settings';

export class Projectile extends PhysicalGameObject {
  private shape: Circle;
  private bounding: PhysicsCircle;

  constructor(private game: IGame, physics: Physics, position: vec2, velocity: vec2) {
    super(physics, true);

    this.shape = new Circle(position, 20);
    this.bounding = new PhysicsCircle(physics, this, position, 20);

    this.bounding.applyForce(velocity, 100);

    this.addCommandExecutor(RenderCommand, this.draw.bind(this));
    this.addCommandExecutor(StepCommand, this.step.bind(this));

    this.addToPhysics(true);
  }

  private draw(c: RenderCommand) {
    c.renderer.addDrawable(this.shape);
  }

  private step(c: StepCommand) {
    this.bounding.applyForce(settings.gravitationalForce, c.deltaTimeInMiliseconds);
    if (this.bounding.step(c.deltaTimeInMiliseconds)) {
      this.game.removeObject(this);
      this.physics.removeDynamicBoundingBox(this.getBoundingBox());
    }
  }

  public getBoundingCircles(): BoundingCircle[] {
    return [this.bounding];
  }

  public getBoundingBox(): BoundingBoxBase {
    return this.bounding.boundingBox;
  }

  public distance(target: vec2): number {
    return this.bounding.distance(target);
  }
}
*/
