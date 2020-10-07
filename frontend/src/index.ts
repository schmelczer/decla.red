import { glMatrix } from 'gl-matrix';
import { CharacterBase, LampBase, overrideDeserialization, TunnelBase } from 'shared';
import { Game } from './scripts/game';
import { CharacterView } from './scripts/objects/character-view';
import { LampView } from './scripts/objects/lamp-view';
import { TunnelView } from './scripts/objects/tunnel-view';
import './styles/main.scss';

glMatrix.setMatrixArrayType(Array);

overrideDeserialization(CharacterBase, CharacterView);
overrideDeserialization(TunnelBase, TunnelView);
overrideDeserialization(LampBase, LampView);

const main = async () => {
  try {
    await new Game().start();
  } catch (e) {
    console.error(e);
    alert(e);
  }
};

main();
