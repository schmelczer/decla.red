import { glMatrix } from 'gl-matrix';
import {
  LampBase,
  overrideDeserialization,
  PlanetBase,
  CharacterBase,
  ProjectileBase,
} from 'shared';
import './main.scss';
import './scripts/analytics';
import '../static/og-image.png';
import '../static/favicons/apple-touch-icon.png';
import '../static/favicons/favicon-16x16.png';
import '../static/favicons/favicon-32x32.png';
import '../static/favicons/favicon.ico';
import ResizeObserver from 'resize-observer-polyfill';
import { LandingPageBackground } from './scripts/landing-page-background';
import { JoinFormHandler } from './scripts/join-form-handler';
import { handleFullScreen } from './scripts/helper/handle-full-screen';
import { Game } from './scripts/game';
import { initializeOptions } from './scripts/options-handler';
import { SoundHandler, Sounds } from './scripts/sound-handler';
import { VibrationHandler } from './scripts/vibration-handler';
import { CharacterView } from './scripts/objects/types/character-view';
import { LampView } from './scripts/objects/types/lamp-view';
import { PlanetView } from './scripts/objects/types/planet-view';
import { ProjectileView } from './scripts/objects/types/projectile-view';

glMatrix.setMatrixArrayType(Array);

overrideDeserialization(CharacterBase, CharacterView);
overrideDeserialization(PlanetBase, PlanetView);
overrideDeserialization(LampBase, LampView);
overrideDeserialization(ProjectileBase, ProjectileView);

const query = <T extends HTMLElement>(selector: string) =>
  document.querySelector(selector) as T;

const landingUI = query('#landing-ui');
const nameInput = query<HTMLInputElement>('#name');
const joinGameForm = query<HTMLFormElement>('#join-game-form');
const serverContainer = query('#server-container');
const canvas = query<HTMLCanvasElement>('canvas');
const overlay = query('#overlay');
const settings = query('#settings');
const toggleSettingsButton = query('#toggle-settings-container');
const minimize = query('#minimize');
const maximize = query('#maximize');
const logoutButton = query('#logout');
const enableSounds = query<HTMLInputElement>('#enable-sounds');
const enableMusic = query<HTMLInputElement>('#enable-music');
const enableVibration = query<HTMLInputElement>('#enable-vibration');
const spinner = query('#spinner-container');

const joinNotice = document.createElement('p');
joinNotice.className = 'join-notice';
joinNotice.style.display = 'none';
joinGameForm.prepend(joinNotice);

const setVisible = (e: HTMLElement, visible: boolean) => {
  e.style.visibility = visible ? 'inherit' : 'hidden';
};
const setDisplayed = (e: HTMLElement, display: string | null) => {
  e.style.display = display ?? 'none';
};

const toggleSettings = () => {
  settings.className = settings.className === 'open' ? '' : 'open';
  SoundHandler.play(Sounds.click);
};

const applyServerContainerShadows = () => {
  const topShadow = 'inset 0 -8px 8px -8px rgba(0, 0, 0, 0.4)';
  const bottomShadow = 'inset 0 8px 8px -8px rgba(0, 0, 0, 0.4)';

  const { scrollHeight, clientHeight, scrollTop } = serverContainer;
  if (scrollHeight <= clientHeight) {
    serverContainer.style.boxShadow = '';
  } else if (scrollTop <= 0) {
    serverContainer.style.boxShadow = topShadow;
  } else if (scrollTop + clientHeight >= scrollHeight) {
    serverContainer.style.boxShadow = bottomShadow;
  } else {
    serverContainer.style.boxShadow = topShadow + ',' + bottomShadow;
  }
};

const main = async () => {
  let game: Game | undefined;

  const storedUserName = localStorage.getItem('userName');
  if (storedUserName) {
    nameInput.value = JSON.parse(storedUserName);
  }

  const firstClickListener = () => {
    SoundHandler.initialize(
      () => {
        enableMusic.checked = true;
        enableMusic.dispatchEvent(new Event('change'));
      },
      () => {
        enableMusic.checked = false;
        enableMusic.dispatchEvent(new Event('change'));
      },
    );
    document.removeEventListener('click', firstClickListener);
  };
  document.addEventListener('click', firstClickListener);

  if (!VibrationHandler.isVibrationEnabledHeuristics) {
    setDisplayed(query("label[for='enable-vibration']"), null);
  }

  handleFullScreen(minimize, maximize);
  toggleSettingsButton.addEventListener('click', toggleSettings);

  new ResizeObserver(applyServerContainerShadows).observe(serverContainer);
  serverContainer.addEventListener('scroll', applyServerContainerShadows);

  initializeOptions({
    soundsEnabled: enableSounds,
    vibrationEnabled: enableVibration,
    musicEnabled: enableMusic,
  });

  logoutButton.addEventListener('click', () => {
    game?.destroy();
    toggleSettings();
  });
  window.onpopstate = () => game?.destroy();

  for (;;) {
    setVisible(spinner, true);
    setDisplayed(logoutButton, null);
    setDisplayed(landingUI, 'flex');

    const background = new LandingPageBackground(canvas);
    const joinHandler = new JoinFormHandler(joinGameForm, serverContainer);

    await background.renderer;
    setVisible(spinner, false);

    const playerDecision = await joinHandler.getPlayerDecision();

    localStorage.setItem('userName', JSON.stringify(playerDecision.name));

    if (!history.state) {
      history.pushState(true, '');
    }

    setDisplayed(landingUI, null);
    setVisible(spinner, true);
    background.destroy();
    game = new Game(playerDecision, canvas, overlay);
    const gameOver = game.start();
    await game.started;
    setVisible(spinner, false);
    setDisplayed(logoutButton, 'block');
    await gameOver;

    const reason = game.rejectionReason;
    joinNotice.innerText = reason ? Game.rejectionText(reason) : '';
    setDisplayed(joinNotice, reason ? 'block' : null);
  }
};

main().catch((error) => {
  console.error(error);
  setVisible(spinner, false);
  joinNotice.innerText = 'Something went wrong. Please reload the page.';
  setDisplayed(joinNotice, 'block');
});
