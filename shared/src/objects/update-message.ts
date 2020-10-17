import { serializable } from '../transport/serialization/serializable';
import { InterpolationType } from './interpolation-type';

@serializable
export class UpdateMessage {
  constructor(
    public key: string,
    public value: any,
    public interpolationType?: InterpolationType,
  ) {}

  public toArray(): Array<any> {
    return [this.key, this.value, this.interpolationType];
  }
}
