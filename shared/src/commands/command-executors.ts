export type CommandExecutors = {
  [type: string]: (command: any) => unknown;
};
