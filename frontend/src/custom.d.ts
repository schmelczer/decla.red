declare module '*.mp3' {
  const content: string;
  export default content;
}

// TypeScript 5.x+ requires ambient declarations for side-effect asset imports.
declare module '*.png';
declare module '*.ico';
declare module '*.svg';
declare module '*.scss';

// Declare just NODE_ENV (DefinePlugin inlines it) so browser code need not pull in all of @types/node.
declare const process: { env: { NODE_ENV?: string } };
