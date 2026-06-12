import { CharacterTeam, UpdateGameState, clamp, settings } from 'shared';

// Centred tug-of-war territory bar. The two fills meet at the bar's centre and
// grow outward by each team's share of the score limit, so the meeting point
// reads as the lead at a glance. Numeric scores are overlaid (the leader's is
// emphasised) and a "YOU" tick marks the local team's half. Owns its own DOM so
// the Game just appends `element` to the overlay and feeds it `update()`.
export class Scoreboard {
  public readonly element = document.createElement('div');

  private readonly blueFill = document.createElement('div');
  private readonly redFill = document.createElement('div');
  private readonly blueScore = document.createElement('span');
  private readonly redScore = document.createElement('span');
  private readonly youMarker = document.createElement('div');

  constructor() {
    this.element.className = 'planet-progress';

    this.blueFill.className = 'fill blue';
    this.redFill.className = 'fill red';

    this.blueScore.className = 'score blue';
    this.redScore.className = 'score red';

    this.youMarker.className = 'you-marker';
    this.youMarker.innerText = 'YOU';

    this.element.append(
      this.blueFill,
      this.redFill,
      this.blueScore,
      this.redScore,
      this.youMarker,
    );
  }

  public update(
    { blueCount, redCount, limit }: UpdateGameState,
    localTeam: CharacterTeam | undefined,
  ) {
    const { scoreboardHalfWidthPercent, scoreboardMinFillPercent } = settings;
    const fraction = (count: number) =>
      Math.max(
        count > 0 ? scoreboardMinFillPercent : 0,
        clamp(count / limit, 0, 1) * scoreboardHalfWidthPercent,
      );

    this.blueFill.style.width = fraction(blueCount) + '%';
    this.redFill.style.width = fraction(redCount) + '%';

    const isMatchPoint = (count: number) =>
      count / limit >= settings.matchPointScoreRatio;
    this.blueFill.classList.toggle('match-point', isMatchPoint(blueCount));
    this.redFill.classList.toggle('match-point', isMatchPoint(redCount));

    this.blueScore.innerText = String(Math.round(blueCount));
    this.redScore.innerText = String(Math.round(redCount));

    this.blueScore.classList.toggle('leading', blueCount > redCount);
    this.redScore.classList.toggle('leading', redCount > blueCount);

    if (localTeam === CharacterTeam.blue || localTeam === CharacterTeam.red) {
      this.youMarker.style.display = '';
      this.youMarker.classList.toggle('blue', localTeam === CharacterTeam.blue);
      this.youMarker.classList.toggle('red', localTeam === CharacterTeam.red);
    } else {
      this.youMarker.style.display = 'none';
    }
  }
}
