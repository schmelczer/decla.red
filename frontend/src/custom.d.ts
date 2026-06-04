declare module '*.mp3' {
  const content: string;
  export default content;
}

// Asset imports handled by webpack loaders. TypeScript 5.x+ requires ambient
// declarations for side-effect imports of these, so declare them here.
declare module '*.png';
declare module '*.ico';
declare module '*.svg';
declare module '*.scss';

// webpack's `mode` inlines `process.env.NODE_ENV` via DefinePlugin. Declare just
// that one global so browser code can read it without pulling in all of @types/node.
declare const process: { env: { NODE_ENV?: string } };
