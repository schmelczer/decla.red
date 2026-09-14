import { SoundHandler, Sounds } from '../sound-handler';

export const handleFullScreen = (
  minimizeButton: HTMLElement,
  maximizeButton: HTMLElement,
) => {
  if (!document.fullscreenEnabled) {
    minimizeButton.style.visibility = 'hidden';
    maximizeButton.style.visibility = 'hidden';
    return;
  }

  const isInFullScreen = (): boolean => document.fullscreenElement !== null;

  const showButtons = () => {
    minimizeButton.style.visibility = isInFullScreen() ? 'visible' : 'hidden';
    maximizeButton.style.visibility = isInFullScreen() ? 'hidden' : 'visible';
  };

  showButtons();
  document.addEventListener('fullscreenchange', showButtons);

  const triggerToggle = async () => {
    try {
      await (isInFullScreen()
        ? document.exitFullscreen()
        : document.body.requestFullscreen());
      SoundHandler.play(Sounds.click);
    } catch {
      // The browser may deny fullscreen (for example, when embedded).
    }
  };

  addEventListener('keydown', (e) => {
    if (e.key === 'F11') {
      e.preventDefault();
      if (!e.repeat) {
        void triggerToggle();
      }
    }
  });

  maximizeButton.addEventListener('click', triggerToggle);
  minimizeButton.addEventListener('click', triggerToggle);
};
