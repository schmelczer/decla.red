import { SoundHandler, Sounds } from './sound-handler';

export const handleFullScreen = (
  minimizeButton: HTMLElement,
  maximizeButton: HTMLElement,
) => {
  if (!document.fullscreenEnabled) {
    minimizeButton.style.visibility = 'hidden';
    maximizeButton.style.visibility = 'hidden';
    return;
  }

  let isInFullScreen = (): boolean => document.fullscreenElement !== null;

  const showButtons = () => {
    minimizeButton.style.visibility = isInFullScreen() ? 'visible' : 'hidden';
    maximizeButton.style.visibility = isInFullScreen() ? 'hidden' : 'visible';
  };

  showButtons();

  let currentWindowHeight = innerHeight;

  const followToggle = () => {
    SoundHandler.play(Sounds.click);
    showButtons();
    currentWindowHeight = innerHeight;
  };

  const triggerToggle = async () => {
    await (isInFullScreen()
      ? document.exitFullscreen()
      : document.body.requestFullscreen());
    followToggle();
  };

  addEventListener('keydown', (e) => {
    if (e.key === 'F11') {
      triggerToggle();
      e.preventDefault();
    }
  });

  addEventListener('resize', () => {
    if (isInFullScreen && currentWindowHeight > innerHeight) {
      followToggle();
    }
  });

  maximizeButton.addEventListener('click', triggerToggle);
  minimizeButton.addEventListener('click', triggerToggle);
};
