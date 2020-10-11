import { vec2 } from 'gl-matrix';
import {
  id,
  StepCommand,
  settings,
  CommandExecutors,
  serializesTo,
  ProjectileBase,
} from 'shared';
import { ImmutableBoundingBox } from '../physics/bounding-boxes/immutable-bounding-box';
import { CirclePhysical } from './circle-physical';
import { Physical } from '../physics/physical';
import { PhysicalContainer } from '../physics/containers/physical-container';

@serializesTo(ProjectileBase)
export class ProjectilePhysical extends ProjectileBase implements Physical {
  public readonly canCollide = true;
  public readonly isInverted = false;
  public readonly canMove = true;

  public object: CirclePhysical;

  protected commandExecutors: CommandExecutors = {
    [StepCommand.type]: this.step.bind(this),
  };

  constructor(
    center: vec2,
    radius: number,
    startingForce: vec2,
    readonly container: PhysicalContainer,
  ) {
    super(id(), center, radius);
    this.object = new CirclePhysical(center, radius, this, container);
    this.object.applyForce(startingForce, 1000);
  }

  private _boundingBox?: ImmutableBoundingBox;

  public get boundingBox(): ImmutableBoundingBox {
    if (!this._boundingBox) {
      this._boundingBox = (this.object as CirclePhysical).boundingBox;
    }

    return this._boundingBox;
  }

  public get gameObject(): this {
    return this;
  }

  public distance(target: vec2): number {
    return this.object.distance(target);
  }

  public step(c: StepCommand) {
    const deltaTime = c.deltaTimeInMiliseconds / 1000;
    this.object.applyForce(settings.gravitationalForce, deltaTime);
    this.object.step(deltaTime);
  }
}
