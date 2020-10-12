import { settings } from 'shared';

const colorUsage: Array<boolean> = new Array(settings.playerColors.length).fill(false);

export const requestColor = (): number => {
  const index = colorUsage.findIndex((a) => !a);
  if (index >= 0) {
    colorUsage[index] = true;
  }
  return index + settings.playerColorIndexOffset;
};

export const freeColor = (index: number) => {
  colorUsage[index - settings.playerColorIndexOffset] = false;
};
