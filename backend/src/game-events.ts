import { CharacterTeam } from 'shared';

export interface GameEvents {
  addPoints(blue: number, red: number): void;
  announce(text: string): void;
}

export const addPointsForTeam = (
  game: GameEvents,
  team: CharacterTeam,
  points: number,
): void => {
  game.addPoints(
    team === CharacterTeam.blue ? points : 0,
    team === CharacterTeam.red ? points : 0,
  );
};
