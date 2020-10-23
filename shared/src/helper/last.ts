export function last<T>(a: ArrayLike<T>): T | null {
  return a.length > 0 ? a[a.length - 1] : null;
}
