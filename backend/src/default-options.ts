import { Options } from './options';

export const defaultOptions: Options = {
  port: 3000,
  name: 'Test server',
  playerLimit: 16,
  npcCount: 6,
  seed: Math.random(),
  scoreLimit: 500,
  worldSize: 8000,
};
