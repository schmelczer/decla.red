import { vec2 } from 'gl-matrix';
import { GameObject, Id } from '../../main';
import { typed } from '../../transport/typed';

export abstract class TunnelBase extends GameObject {
  public static readonly type = 'Tunnel';

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
