import { CreatePlayerCommand } from '../commands/types/create-player';
import { MoveActionCommand } from '../commands/types/move-action';
import { PrimaryActionCommand } from '../commands/types/primary-action';
import { SecondaryActionCommand } from '../commands/types/secondary-action';
import { SetViewAreaActionCommand } from '../commands/types/set-view-area-action';
import { TernaryActionCommand } from '../commands/types/ternary-action';
import { UpdateObjectsCommand } from '../commands/types/update-objects';
import { Command, CreateObjectsCommand, DeleteObjectsCommand } from '../main';

export const commandConstructors: {
  [type: string]: new (...values: Array<any>) => any;
} = {
  [CreateObjectsCommand.type]: CreateObjectsCommand,
  [DeleteObjectsCommand.type]: DeleteObjectsCommand,
  [CreatePlayerCommand.type]: CreatePlayerCommand,
  [MoveActionCommand.type]: MoveActionCommand,
  [PrimaryActionCommand.type]: PrimaryActionCommand,
  [SecondaryActionCommand.type]: SecondaryActionCommand,
  [TernaryActionCommand.type]: TernaryActionCommand,
  [SetViewAreaActionCommand.type]: SetViewAreaActionCommand,
  [UpdateObjectsCommand.type]: UpdateObjectsCommand,
};

export const deserializeCommand = ([type, ...values]: [string, Array<any>]): Command => {
  return new commandConstructors[type](...values);
};
