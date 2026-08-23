import { vec2 } from 'gl-matrix';
import { clamp } from './clamp';

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const finiteInRange = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number => {
  if (!isFiniteNumber(value)) {
    return fallback;
  }
  return clamp(value, min, max);
};

export const finiteVec2 = (value: unknown, maxMagnitude: number): vec2 | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as ArrayLike<unknown>;
  if (candidate.length < 2) {
    return undefined;
  }

  const x = candidate[0];
  const y = candidate[1];
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
    return undefined;
  }

  const result = vec2.fromValues(x, y);
  const length = vec2.length(result);
  if (length > maxMagnitude) {
    vec2.scale(result, result, maxMagnitude / length);
  }

  return result;
};

export const sanitizeName = (value: unknown, maxLength: number): string => {
  const text = typeof value === 'string' ? value : String(value ?? '');
  return text.slice(0, maxLength);
};
