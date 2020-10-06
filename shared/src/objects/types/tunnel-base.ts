import { vec2 } from 'gl-matrix';
import { GameObject, Id } from '../../main';

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
}
