export const hide = (e: HTMLElement, useDisplay = false) => {
  if (useDisplay) {
    e.style.display = 'none';
  } else {
    e.style.visibility = 'hidden';
  }
};
