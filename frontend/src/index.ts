import { glMatrix } from 'gl-matrix';
import {
  CharacterBase,
  LampBase,
  overrideDeserialization,
  PlanetBase,
  PlayerCharacterBase,
  ProjectileBase,
} from 'shared';
import { CharacterView } from './scripts/objects/character-view';
import { LampView } from './scripts/objects/lamp-view';
import { ProjectileView } from './scripts/objects/projectile-view';
import { PlanetView } from './scripts/objects/planet-view';
import './styles/main.scss';
import { LandingPageBackground } from './scripts/landing-page-background';
import { JoinFormHandler } from './scripts/join-form-handler';
import { Game } from './scripts/game';
import { PlayerCharacterView } from './scripts/objects/player-character-view';

glMatrix.setMatrixArrayType(Array);

overrideDeserialization(CharacterBase, CharacterView);
overrideDeserialization(PlayerCharacterBase, PlayerCharacterView);
overrideDeserialization(PlanetBase, PlanetView);
overrideDeserialization(LampBase, LampView);
overrideDeserialization(ProjectileBase, ProjectileView);

const main = async () => {
  try {
    const landingUI = document.querySelector('#landing-ui') as HTMLElement;
    const joinGameForm = document.querySelector('#join-game-form') as HTMLFormElement;
    const serverContainer = document.querySelector('#server-container') as HTMLElement;
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    const overlay = document.querySelector('#overlay') as HTMLElement;

    const background = new LandingPageBackground(canvas);
    const joinHandler = new JoinFormHandler(joinGameForm, serverContainer);

    const playerDecision = await joinHandler.getPlayerDecision();
    landingUI.style.display = 'none';

    background.destroy();
    await new Game(playerDecision, canvas, overlay).start();
  } catch (e) {
    console.error(e);
    alert(e);
  }
};

main();
