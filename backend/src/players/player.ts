import { vec2 } from 'gl-matrix';
import {
  CommandExecutors,
  CreateObjectsCommand,
  CreatePlayerCommand,
  DeleteObjectsCommand,
  MoveActionCommand,
  serialize,
  TransportEvents,
  SetAspectRatioActionCommand,
  calculateViewArea,
  settings,
  PlayerInformation,
  CharacterTeam,
  UpdateOtherPlayerDirections,
  GameObject,
  Command,
  OtherPlayerDirection,
  RemoteCallsForObject,
  RemoteCallsForObjects,
  ServerAnnouncement,
  PropertyUpdatesForObjects,
  PropertyUpdatesForObject,
  PrimaryActionCommand,
} from 'shared';
import { BoundingBox } from '../physics/bounding-boxes/bounding-box';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { CharacterPhysical } from '../objects/character-physical';
import { PlayerContainer } from './player-container';
import { PlayerBase } from './player-base';

export class Player extends PlayerBase {
  // default, until the clients sends its real value
  private aspectRatio: number = 16 / 9;
  private timeUntilRespawn = 0;
  private timeSinceLastMessage = 0;
  private objectsPreviouslyInViewArea: Array<GameObject> = [];

  protected commandExecutors: CommandExecutors = {
    [SetAspectRatioActionCommand.type]: (v: SetAspectRatioActionCommand) =>
      (this.aspectRatio = v.aspectRatio),
    [MoveActionCommand.type]: (c: MoveActionCommand) =>
      this.character?.handleMovementAction(c),
    [PrimaryActionCommand.type]: (c: PrimaryActionCommand) => {
      this.character?.shootTowards(c.position);
    },
  };

  constructor(
    playerInfo: PlayerInformation,
    playerContainer: PlayerContainer,
    objectContainer: PhysicalContainer,
    team: CharacterTeam,
    private readonly socket: SocketIO.Socket,
  ) {
    super(playerInfo, playerContainer, objectContainer, team);
    this.createCharacter();
    this.step(0);
  }

  protected createCharacter() {
    const preferredCenter = this.playerContainer.players.find(
      (p) => p.character?.isAlive && p.team === this.team,
    )?.center;

    super.createCharacter(preferredCenter ?? vec2.create());

    this.objectsPreviouslyInViewArea.push(this.character!);
    this.queueCommandSend(new CreatePlayerCommand(this.character!));
  }

  private winnerTeam?: CharacterTeam;
  public onGameEnded(winnerTeam: CharacterTeam) {
    this.winnerTeam = winnerTeam;
  }

  public step(deltaTimeInSeconds: number) {
    if (this.character) {
      this.center = this.character?.center;

      if (!this.character.isAlive) {
        this.sumDeaths++;
        this.sumKills = this.character.killCount;

        this.character = null;
        this.timeUntilRespawn = settings.playerDiedTimeout;
      }
    } else {
      if ((this.timeUntilRespawn -= deltaTimeInSeconds) < 0) {
        this.createCharacter();
        this.center = this.character!.center;
      }
    }

    const remoteCalls = this.objectsPreviouslyInViewArea
      .map((g) => new RemoteCallsForObject(g.id, g.getRemoteCalls()))
      .filter((c) => c.calls.length > 0);

    if (remoteCalls.length > 0) {
      this.queueCommandSend(new RemoteCallsForObjects(remoteCalls));
    }
  }

  private handleViewAreaUpdate() {
    const viewArea = calculateViewArea(this.center, this.aspectRatio, 1.2);
    const bb = new BoundingBox();
    bb.topLeft = viewArea.topLeft;
    bb.size = viewArea.size;

    const objectsInViewArea = Array.from(
      new Set(this.objectContainer.findIntersecting(bb).map((o) => o.gameObject)),
    );

    const newlyIntersecting = objectsInViewArea.filter(
      (o) => !this.objectsPreviouslyInViewArea.includes(o),
    );

    const noLongerIntersecting = this.objectsPreviouslyInViewArea.filter(
      (o) => !objectsInViewArea.includes(o),
    );

    this.objectsPreviouslyInViewArea = objectsInViewArea;

    if (noLongerIntersecting.length > 0) {
      this.queueCommandSend(
        new DeleteObjectsCommand(noLongerIntersecting.map((g) => g.id)),
      );
    }

    if (newlyIntersecting.length > 0) {
      this.queueCommandSend(new CreateObjectsCommand(newlyIntersecting));
    }

    this.queueCommandSend(new UpdateOtherPlayerDirections(this.getOtherPlayers()));

    this.queueCommandSend(
      new PropertyUpdatesForObjects(
        this.objectsPreviouslyInViewArea
          .map((o) => o.getPropertyUpdates())
          .filter((u) => u) as Array<PropertyUpdatesForObject>,
      ),
    );
  }

  private getOtherPlayers(): Array<OtherPlayerDirection> {
    if (!this.character) {
      return [];
    }

    const viewArea = calculateViewArea(this.center, this.aspectRatio, 0.9);
    const bb = new BoundingBox();
    bb.topLeft = viewArea.topLeft;
    bb.size = viewArea.size;

    const playersInViewArea = this.objectContainer
      .findIntersecting(bb)
      .map((o) => o.gameObject)
      .filter((g) => g instanceof CharacterPhysical);

    const otherPlayers = this.playerContainer.players.filter(
      (p) => p.character?.isAlive && playersInViewArea.indexOf(p.character!) < 0,
    );

    return otherPlayers.map(
      (p) =>
        new OtherPlayerDirection(
          p.character!.id,
          vec2.normalize(
            vec2.create(),
            vec2.subtract(vec2.create(), p.character!.center, this.character!.center),
          ),
          p.team,
        ),
    );
  }

  private commandsToBeSent: Array<Command> = [];
  public queueCommandSend(command: Command) {
    this.commandsToBeSent.push(command);
  }

  public stepCommunications(deltaTime: number) {
    if ((this.timeSinceLastMessage += deltaTime) > settings.updateMessageInterval) {
      this.handleAnnouncements();
      this.handleViewAreaUpdate();
      this.sendQueuedCommandsToClient();
      this.timeSinceLastMessage = 0;
    }
  }

  public sendQueuedCommandsToClient() {
    this.socket.emit(TransportEvents.ServerToPlayer, serialize(this.commandsToBeSent));
    this.commandsToBeSent = [];
  }

  private handleAnnouncements() {
    let announcement = '';
    if (this.winnerTeam) {
      announcement = `Team <span class="${this.winnerTeam}">${this.winnerTeam}</span> won 🎉`;
    } else if (!this.character) {
      announcement = `Reviving in ${Math.round(this.timeUntilRespawn)}…`;
    }

    if (announcement) {
      this.queueCommandSend(new ServerAnnouncement(announcement));
    }
  }

  public destroy() {
    super.destroy();
  }
}
