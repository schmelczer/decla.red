import { glMatrix } from 'gl-matrix';
import { CharacterBase, LampBase, overrideDeserialization, PlanetBase } from 'shared';
import { ProjectileBase } from 'shared/src/objects/types/projectile-base';

import { CharacterView } from './scripts/objects/character-view';
import { LampView } from './scripts/objects/lamp-view';
import { ProjectileView } from './scripts/objects/projectile-view';
import { PlanetView } from './scripts/objects/planet-view';
import './styles/main.scss';
import { LandingPageBackground } from './scripts/landing-page-background';
import { JoinFormHandler } from './scripts/join-form-handler';
import { Game } from './scripts/game';

glMatrix.setMatrixArrayType(Array);

overrideDeserialization(CharacterBase, CharacterView);
overrideDeserialization(PlanetBase, PlanetView);
overrideDeserialization(LampBase, LampView);
overrideDeserialization(ProjectileBase, ProjectileView);

const addSupportForTabNavigation = () =>
  (document.onkeydown = (e) => {
    if (e.key === ' ') {
      (document.activeElement as HTMLElement)?.click();
      e.preventDefault();
    }
  });

/*const removeUnnecessaryOutlines = () =>
  (document.onclick = (e) => {
    (e.target as HTMLElement)?.blur();
  });
*/
addSupportForTabNavigation();
//removeUnnecessaryOutlines();

const main = async () => {
  try {
    const landingUI = document.querySelector('#landing-ui') as HTMLElement;
    const background = new LandingPageBackground();
    const joinHandler = new JoinFormHandler(
      document.querySelector('#join-game-form') as HTMLFormElement,
      document.querySelector('#server-container') as HTMLElement,
    );
    const playerDecision = await joinHandler.getPlayerDecision();
    landingUI.style.display = 'none';
    console.log(playerDecision);
    background.destroy();
    await new Game(playerDecision).start();
  } catch (e) {
    console.error(e);
    alert(e);
  }
};

main();
