import {
  CharacterBase,
  commandConstructors,
  GameObject,
  LampBase,
  TunnelBase,
} from 'shared';
import { CharacterView } from '../objects/character-view';
import { LampView } from '../objects/lamp-view';
import { TunnelView } from '../objects/tunnel-view';

const constructors: { [type: string]: new (...values: Array<any>) => GameObject } = {
  [TunnelBase.type]: TunnelView,
  [LampBase.type]: LampView,
  [CharacterBase.type]: CharacterView,
  ...commandConstructors,
};

export const deserialize = (json: string): GameObject => {
  const [type, ...values] = JSON.parse(json);
  return new constructors[type](...values);
};

export const deserializeJsonArray = (json: string): Array<GameObject> => {
  return (JSON.parse(json) as Array<any>).map(([type, ...values]) => {
    return new constructors[type](...values);
  });
};
