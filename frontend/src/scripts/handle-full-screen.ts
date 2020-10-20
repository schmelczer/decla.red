export const handleFullScreen = (
  minimizeButton: HTMLElement,
  maximizeButton: HTMLElement,
) => {
  if (!document.fullscreenEnabled) {
    minimizeButton.style.visibility = 'hidden';
    maximizeButton.style.visibility = 'hidden';
    return;
  }

  let isInFullScreen = document.fullscreenElement !== null;

  const showButtons = () => {
    minimizeButton.style.visibility = isInFullScreen ? 'visible' : 'hidden';
    maximizeButton.style.visibility = isInFullScreen ? 'hidden' : 'visible';
  };

  showButtons();

  maximizeButton.addEventListener('click', () => document.body.requestFullscreen());
  minimizeButton.addEventListener('click', () => document.exitFullscreen());

  document.addEventListener('fullscreenchange', () => {
    isInFullScreen = !isInFullScreen;
    showButtons();
  });
};
