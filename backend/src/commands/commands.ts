import { Command, CommandReceiver, GameObject } from 'shared';

export class StepCommand extends Command {
  constructor(
    public readonly deltaTimeInSeconds: number,
    public readonly game: CommandReceiver,
  ) {
    super();
  }
}

export class GeneratePointsCommand extends Command {
  constructor(
    public readonly blue: number,
    public readonly red: number,
  ) {
    super();
  }
}

export class AnnounceCommand extends Command {
  constructor(public readonly text: string) {
    super();
  }
}

export class ReactToCollisionCommand extends Command {
  constructor(public readonly other: GameObject) {
    super();
  }
}
