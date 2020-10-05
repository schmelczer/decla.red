import { vec2 } from 'gl-matrix';
import { id, CharacterBase } from 'shared';

import { ImmutableBoundingBox } from '../physics/bounding-boxes/immutable-bounding-box';

import { CirclePhysical } from './circle-physical';
import { Physical } from '../physics/physical';

export class CharacterPhysical extends CharacterBase implements Physical {
  public readonly canCollide = true;
  public readonly isInverted = false;
  public readonly canMove = true;

  private static readonly headOffset = vec2.fromValues(0, 40);
  private static readonly leftFootOffset = vec2.fromValues(-20, -10);
  private static readonly rightFootOffset = vec2.fromValues(20, -10);

  constructor() {
    super(
      id(),
      new CirclePhysical(vec2.clone(CharacterPhysical.headOffset), 50, null),
      new CirclePhysical(vec2.clone(CharacterPhysical.leftFootOffset), 20, null),
      new CirclePhysical(vec2.clone(CharacterPhysical.rightFootOffset), 20, null)
    );
  }

  private _boundingBox?: ImmutableBoundingBox;

  public get boundingBox(): ImmutableBoundingBox {
    if (!this._boundingBox) {
      this._boundingBox = (this.head as CirclePhysical).boundingBox;
    }

    return this._boundingBox;
  }

  public get gameObject(): CharacterPhysical {
    return this;
  }

  // todo
  public distance(_: vec2): number {
    return 0;
  }
  /*
  public step() {
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
*/
  public toJSON(): any {
    const { type, id, head, leftFoot, rightFoot } = this;
    return [type, id, head, leftFoot, rightFoot];
  }
}
