import { CharacterTeam, Random } from 'shared';

let declaCount = 0;
let redCount = 0;

export const requestTeam = (): { team: CharacterTeam; colorIndex: number } => {
  if ((declaCount === redCount && Random.getRandom() > 0.5) || declaCount < redCount) {
    declaCount++;
    return { team: CharacterTeam.decla, colorIndex: 0 };
  } else {
    redCount++;
    return { team: CharacterTeam.red, colorIndex: 1 };
  }
};

export const freeTeam = (team: CharacterTeam) => {
  if (team === CharacterTeam.decla) {
    declaCount--;
  } else {
    redCount--;
  }
};
