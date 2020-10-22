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
import { handleFullScreen } from './scripts/handle-full-screen';
import { Game } from './scripts/game';
import { PlayerCharacterView } from './scripts/objects/player-character-view';
import '../static/settings.svg';
import '../static/minimize.svg';
import '../static/maximize.svg';
import { handleInsights } from './scripts/handle-insights';
import { getInsightsFromRenderer } from './scripts/get-insights-from-renderer';
import { Renderer } from 'sdf-2d';
import ResizeObserver from 'resize-observer-polyfill';
import { OptionsHandler } from './scripts/options-handler';

glMatrix.setMatrixArrayType(Array);

overrideDeserialization(CharacterBase, CharacterView);
overrideDeserialization(PlayerCharacterBase, PlayerCharacterView);
overrideDeserialization(PlanetBase, PlanetView);
overrideDeserialization(LampBase, LampView);
overrideDeserialization(ProjectileBase, ProjectileView);

const landingUI = document.querySelector('#landing-ui') as HTMLElement;
const joinGameForm = document.querySelector('#join-game-form') as HTMLFormElement;
const serverContainer = document.querySelector('#server-container') as HTMLElement;
const canvas = document.querySelector('canvas') as HTMLCanvasElement;
const overlay = document.querySelector('#overlay') as HTMLElement;
const settings = document.querySelector('#settings') as HTMLElement;
const toggleSettingsButton = document.querySelector(
  '#toggle-settings-container',
) as HTMLElement;
const minimize = document.querySelector('#minimize') as HTMLElement;
const maximize = document.querySelector('#maximize') as HTMLElement;
const logoutButton = document.querySelector('#logout') as HTMLElement;
const enableRelativeMovement = document.querySelector(
  '#enable-relative-movement',
) as HTMLInputElement;
const enableSounds = document.querySelector('#enable-sounds') as HTMLInputElement;
const enableVibration = document.querySelector('#enable-vibration') as HTMLInputElement;

let isInGame = false;

const startInsights = (getRenderer: () => Renderer | undefined) => {
  const { vendor, renderer } = getInsightsFromRenderer(getRenderer());
  handleInsights(
    {
      vendor,
      renderer,
      referrer: document.referrer,
      connection: (navigator as any)?.connection?.effectiveType,
      devicePixelRatio: devicePixelRatio,
    },
    () => {
      const {
        fps,
        renderScale,
        lightScale,
        canvasWidth,
        canvasHeight,
      } = getInsightsFromRenderer(getRenderer());

      return {
        isInGame,
        fps,
        renderScale,
        lightScale,
        canvasWidth,
        canvasHeight,
      };
    },
  );
};

const toggleSettings = () =>
  (settings.className = settings.className === 'open' ? '' : 'open');

const applyServerContainerShadows = () => {
  const { scrollHeight, clientHeight, scrollTop } = serverContainer;
  console.log(scrollHeight, clientHeight, scrollTop);
  if (scrollHeight > clientHeight) {
    serverContainer.className = 'scroll';
    if (scrollTop === 0) {
      serverContainer.className += ' top';
    } else if (scrollTop + clientHeight === scrollHeight) {
      serverContainer.className += ' bottom';
    }
  }
};

const main = async () => {
  try {
    let game: Game;

    handleFullScreen(minimize, maximize);
    toggleSettingsButton.addEventListener('click', toggleSettings);

    new ResizeObserver(applyServerContainerShadows).observe(serverContainer);
    serverContainer.addEventListener('scroll', applyServerContainerShadows);

    OptionsHandler.initialize({
      relativeMovementEnabled: enableRelativeMovement,
      soundsEnabled: enableSounds,
      vibrationEnabled: enableVibration,
    });

    logoutButton.addEventListener('click', () => {
      game.destroy();
      toggleSettings();
    });
    window.onpopstate = () => game.destroy();

    let backgroundRenderer: Renderer | undefined;
    startInsights(() => (isInGame ? game.renderer : backgroundRenderer));

    for (;;) {
      landingUI.style.visibility = 'inherit';
      logoutButton.style.visibility = 'hidden';

      const background = new LandingPageBackground(canvas);
      const joinHandler = new JoinFormHandler(joinGameForm, serverContainer);

      backgroundRenderer = await background.renderer;

      const playerDecision = await joinHandler.getPlayerDecision();
      if (!history.state) {
        history.pushState(true, '');
      }

      landingUI.style.visibility = 'hidden';

      background.destroy();

      logoutButton.style.visibility = 'inherit';
      game = new Game(playerDecision, canvas, overlay);
      isInGame = true;
      await game.start();
      isInGame = false;
    }
  } catch (e) {
    console.error(e);
    alert(e);
  }
};

main();
