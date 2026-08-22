import { vec2 } from 'gl-matrix';


export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** A finite number within [min, max], or `fallback` if the input is unusable. */
export const finiteInRange = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number => {
  if (!isFiniteNumber(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
};

/**
 * A finite 2-vector whose magnitude is within `maxMagnitude`, or `undefined` if
 * the input is not a usable pair of finite numbers. Callers should treat
 * `undefined` as "drop this command" rather than substituting a default, so a
 * malformed action is ignored instead of being silently reinterpreted.
 */
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

/**
 * A display name that is safe to store and re-serialize. Anything that is not a
 * string is coerced, because a non-string survives `.slice()` — an array name
 * round-trips through the serializer and is revived as a class on every peer
 * that receives it, throwing inside the deserializer's reviver.
 */
export const sanitizeName = (value: unknown, maxLength: number): string => {
  const text = typeof value === 'string' ? value : String(value ?? '');
  return text.slice(0, maxLength);
};
