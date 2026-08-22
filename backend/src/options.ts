export interface Options {
  port: number;
  name: string;
  playerLimit: number;
  scoreLimit: number;
  npcCount: number;
  seed: number;
}

const isDevelopment = process.env.NODE_ENV !== 'production';

export const defaultOptions: Options = {
  port: 3000,
  name: isDevelopment ? 'Dev server' : 'Doppler server',
  playerLimit: 16,
  npcCount: 8,
  seed: Math.random(),
  scoreLimit: 2500,
};
