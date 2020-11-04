export type Id = number | null;

let currentId = 0;

export const id = (): number => {
  return currentId++;
};
