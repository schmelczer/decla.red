import { vec2 } from 'gl-matrix';
import {
  CharacterTeam,
  CommandExecutors,
  CommandReceiver,
  Id,
  MoveActionCommand,
  PrimaryActionCommand,
} from 'shared';
import { GameObjectContainer } from './objects/game-object-container';
import { PlanetView } from './objects/types/planet-view';

type StageTrigger = 'move' | 'shoot' | 'capture';

const stages: ReadonlyArray<{ hint: string; clearsOn: StageTrigger }> = [
  { hint: 'WASD / drag to walk', clearsOn: 'move' },
  { hint: 'Click / tap to shoot', clearsOn: 'shoot' },
  { hint: 'Stand on a planet to capture it', clearsOn: 'capture' },
];

const captureProgressThreshold = 0.05;

const standingSlack = 200;

export class Tutorial extends CommandReceiver {
  private stage = 0;
  private element = document.createElement('div');

  private characterId?: Id;

  private standingPlanet?: PlanetView;
  private standingBaseline = 0;

  protected commandExecutors: CommandExecutors = {
    [MoveActionCommand.type]: (c: MoveActionCommand) => {
      if (this.clearsOn() === 'move' && vec2.length(c.direction) > 0) {
        this.advance();
      }
    },
    [PrimaryActionCommand.type]: () => {
      if (this.clearsOn() === 'shoot') {
        this.advance();
      }
    },
  };

  constructor(overlay: HTMLElement) {
    super();
    this.element.className = 'tutorial-hint';
    this.element.innerText = stages[0].hint;
    overlay.appendChild(this.element);
  }

  private clearsOn(): StageTrigger | undefined {
    return stages[this.stage]?.clearsOn;
  }

  private advance() {
    this.setStage(this.stage + 1);
  }

  public step(gameObjects: GameObjectContainer) {
    if (this.stage >= stages.length) {
      return;
    }

    const player = gameObjects.player;
    if (!player) {
      return;
    }

    if (this.characterId === undefined) {
      this.characterId = player.id;
    } else if (player.id !== this.characterId) {
      this.finish();
      return;
    }

    if (this.clearsOn() === 'capture') {
      const standing = gameObjects.planets.find(
        (p) => vec2.distance(p.center, player.bodyCenter) < p.radius + standingSlack,
      );
      if (standing !== this.standingPlanet) {
        this.standingPlanet = standing;
        this.standingBaseline = standing?.ownership ?? 0;
      }
      if (standing) {
        const drift = standing.ownership - this.standingBaseline;
        const progress = player.team === CharacterTeam.decla ? -drift : drift;
        if (progress > captureProgressThreshold) {
          this.finish();
        }
      }
    }
  }

  private finish() {
    this.setStage(stages.length);
  }

  private setStage(stage: number) {
    this.stage = stage;
    this.element.innerText = stages[stage]?.hint ?? '';
  }
}
