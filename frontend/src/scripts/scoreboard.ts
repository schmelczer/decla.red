import { CharacterTeam, UpdateGameState, clamp, settings } from 'shared';

// Centred tug-of-war territory bar. The two fills meet at the bar's centre and
// grow outward by each team's share of the score limit, so the meeting point
// reads as the lead at a glance. Numeric scores are overlaid (the leader's is
// emphasised) and a "YOU" tick marks the local team's half. Owns its own DOM so
// the Game just appends `element` to the overlay and feeds it `update()`.
export class Scoreboard {
  public readonly element = document.createElement('div');

  private readonly declaFill = document.createElement('div');
  private readonly redFill = document.createElement('div');
  private readonly declaScore = document.createElement('span');
  private readonly redScore = document.createElement('span');
  private readonly youMarker = document.createElement('div');

  constructor() {
    this.element.className = 'planet-progress';

    this.declaFill.className = 'fill decla';
    this.redFill.className = 'fill red';

    this.declaScore.className = 'score decla';
    this.redScore.className = 'score red';

    this.youMarker.className = 'you-marker';
    this.youMarker.innerText = 'YOU';

    this.element.append(
      this.declaFill,
      this.redFill,
      this.declaScore,
      this.redScore,
      this.youMarker,
    );
  }

  public update(
    { declaCount, redCount, limit }: UpdateGameState,
    localTeam: CharacterTeam | undefined,
  ) {
    const { scoreboardHalfWidthPercent, scoreboardMinFillPercent } = settings;
    const fraction = (count: number) =>
      Math.max(
        count > 0 ? scoreboardMinFillPercent : 0,
        clamp(count / limit, 0, 1) * scoreboardHalfWidthPercent,
      );

    this.declaFill.style.width = fraction(declaCount) + '%';
    this.redFill.style.width = fraction(redCount) + '%';

    this.declaScore.innerText = String(Math.round(declaCount));
    this.redScore.innerText = String(Math.round(redCount));

    this.declaScore.classList.toggle('leading', declaCount > redCount);
    this.redScore.classList.toggle('leading', redCount > declaCount);

    if (localTeam === CharacterTeam.decla || localTeam === CharacterTeam.red) {
      this.youMarker.style.display = '';
      this.youMarker.classList.toggle('decla', localTeam === CharacterTeam.decla);
      this.youMarker.classList.toggle('red', localTeam === CharacterTeam.red);
    } else {
      this.youMarker.style.display = 'none';
    }
  }
}
