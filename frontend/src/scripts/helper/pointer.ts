import { vec2 } from 'gl-matrix';

let displayPosition: vec2 | null = null;

export const setDisplayPosition = (position: vec2): void => {
  displayPosition = position;
};

export const getDisplayPosition = (): vec2 | null => displayPosition;
