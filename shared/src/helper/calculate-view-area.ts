import { vec2 } from 'gl-matrix';
import { Rectangle, settings } from '../main';

export const calculateViewArea = (
  center: vec2,
  aspectRatio: number,
  oversizeRatio = 1,
): Rectangle => {
  const viewArea = new Rectangle();

  viewArea.size = vec2.fromValues(
    Math.sqrt(settings.inViewAreaSize * oversizeRatio * aspectRatio),
    Math.sqrt((settings.inViewAreaSize * oversizeRatio) / aspectRatio),
  );

  viewArea.topLeft = vec2.fromValues(
    center.x - viewArea.size.x / 2,
    center.y + viewArea.size.y / 2,
  );

  return viewArea;
};
