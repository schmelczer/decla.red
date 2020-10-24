export const show = (e: HTMLElement, useDisplay = false, normalDisplayValue?: string) => {
  if (useDisplay) {
    e.style.display = normalDisplayValue!;
  } else {
    e.style.visibility = 'inherit';
  }
};
