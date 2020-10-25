import { vec2 } from 'gl-matrix';
import { CommandReceiver, Circle, PlayerInformation, CharacterTeam } from 'shared';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { getBoundingBoxOfCircle } from '../physics/functions/get-bounding-box-of-circle';
import { isCircleIntersecting } from '../physics/functions/is-circle-intersecting';
import { PlayerCharacterPhysical } from '../objects/player-character-physical';
import { PlayerContainer } from './player-container';

export abstract class PlayerBase extends CommandReceiver {
  public character?: PlayerCharacterPhysical | null;
  public center: vec2 = vec2.create();

  protected sumKills = 0;
  protected sumDeaths = 0;

  constructor(
    protected readonly playerInfo: PlayerInformation,
    protected readonly playerContainer: PlayerContainer,
    protected readonly objectContainer: PhysicalContainer,
    public readonly team: CharacterTeam,
  ) {
    super();
  }

  protected createCharacter() {
    this.character = new PlayerCharacterPhysical(
      this.playerInfo.name.slice(0, 20),
      this.sumKills,
      this.sumDeaths,
      this.team,
      this.objectContainer,
      this.findEmptyPositionForPlayer(),
    );

    this.objectContainer.addObject(this.character);
  }

  public abstract step(deltaTimeInSeconds: number): void;

  protected findEmptyPositionForPlayer(): vec2 {
    let possibleCenter = this.playerContainer.players.find(
      (p) => p.character?.isAlive && p.team === this.team,
    )?.center;

    if (!possibleCenter) {
      possibleCenter = vec2.create();
    }

    let rotation = 0;
    let radius = 0;
    for (;;) {
      const playerPosition = vec2.fromValues(
        radius * Math.cos(rotation) + possibleCenter.x,
        radius * Math.sin(rotation) + possibleCenter.y,
      );

      const playerBoundingCircle = new Circle(
        playerPosition,
        PlayerCharacterPhysical.boundRadius,
      );

      const playerBoundingBox = getBoundingBoxOfCircle(playerBoundingCircle);
      const possibleIntersectors = this.objectContainer.findIntersecting(
        playerBoundingBox,
      );
      if (!isCircleIntersecting(playerBoundingCircle, possibleIntersectors)) {
        return playerPosition;
      }

      rotation += Math.PI / 8;
      radius += 30;
    }
  }

  public destroy() {
    this.character?.destroy();
  }
}
