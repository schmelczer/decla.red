import { vec2 } from 'gl-matrix';
import { Id } from '../../transport/identity';
import { serializable } from '../../transport/serializable/serializable';
import { GameObject } from '../game-object';

@serializable()
export abstract class TunnelBase extends GameObject {
  constructor(
    id: Id,
    public readonly from: vec2,
    public readonly to: vec2,
    public readonly fromRadius: number,
    public readonly toRadius: number
  ) {
    super(id);
  }

  public toArray(): Array<any> {
    const { id, from, to, fromRadius, toRadius } = this as any;
    return [id, from, to, fromRadius, toRadius];
  }
}
