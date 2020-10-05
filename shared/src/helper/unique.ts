let currentId = 0;

export const id = (): number => {
  return currentId++;
};
