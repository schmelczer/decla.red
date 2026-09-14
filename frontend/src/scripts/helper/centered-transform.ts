export const centeredTransform = (x: number, y: number, extra = ''): string =>
  `translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)${extra}`;
