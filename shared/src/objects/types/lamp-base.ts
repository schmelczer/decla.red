import { vec2, vec3 } from 'gl-matrix';
import { Id, serializable } from '../../main';
import { toArrayFromFields } from '../../serialization/serialized-fields';
import { GameObject } from '../game-object';

@serializable
export class LampBase extends GameObject {
  private static readonly serializedFields = [
    'id',
    'center',
    'color',
    'lightness',
  ] as const;

  constructor(
    id: Id,
    public center: vec2,
    public color: vec3,
    public lightness: number,
  ) {
    super(id);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public setLight(color: vec3, lightness: number) {}

  public toArray(): Array<any> {
    return toArrayFromFields(this, LampBase.serializedFields);
  }
}
