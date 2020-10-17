import { GameObject, serializesTo, UpdateMessage, UpdateObjectMessage } from 'shared';

@serializesTo(UpdateObjectMessage)
export class UpdateGameObjectMessage<T extends GameObject> extends UpdateObjectMessage {
  constructor(object: T, keys: Array<string & keyof T>) {
    super(
      object.id,
      keys.map((k) => new UpdateMessage(k, object[k])),
    );
  }
}
