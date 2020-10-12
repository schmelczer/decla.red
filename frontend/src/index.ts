import { glMatrix } from 'gl-matrix';
import { CharacterBase, LampBase, overrideDeserialization, StoneBase } from 'shared';
import { ProjectileBase } from 'shared/src/objects/types/projectile-base';
import { Game } from './scripts/game';
import { CharacterView } from './scripts/objects/character-view';
import { LampView } from './scripts/objects/lamp-view';
import { ProjectileView } from './scripts/objects/projectile-view';
import { StoneView } from './scripts/objects/stone-view';
import './styles/main.scss';

glMatrix.setMatrixArrayType(Array);

overrideDeserialization(CharacterBase, CharacterView);
overrideDeserialization(StoneBase, StoneView);
overrideDeserialization(LampBase, LampView);
overrideDeserialization(ProjectileBase, ProjectileView);

const main = async () => {
  try {
    await new Game().start();
  } catch (e) {
    console.error(e);
    alert(e);
  }
};

main();
