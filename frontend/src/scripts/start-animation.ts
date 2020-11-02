import {
  CircleLight,
  ColorfulCircle,
  FilteringOptions,
  Flashlight,
  Renderer,
  runAnimation,
  WrapOptions,
} from 'sdf-2d';
import { settings } from 'shared';
import { BlobShape } from './shapes/blob-shape';
import { PlanetShape } from './shapes/planet-shape';

export const startAnimation = async (
  canvas: HTMLCanvasElement,
  draw: (r: Renderer, current: number, delta: number) => boolean,
  noiseTexture: TexImageSource,
): Promise<void> =>
  await runAnimation(
    canvas,
    [
      {
        ...PlanetShape.descriptor,
        shaderCombinationSteps: [0, 1, 2, 3],
      },
      {
        ...BlobShape.descriptor,
        shaderCombinationSteps: [0, 1, 2, 8],
      },
      {
        ...ColorfulCircle.descriptor,
        shaderCombinationSteps: [0, 2, 16],
      },
      {
        ...CircleLight.descriptor,
        shaderCombinationSteps: [0, 1, 2, 4, 8, 16],
      },
      {
        ...Flashlight.descriptor,
        shaderCombinationSteps: [0],
      },
    ],
    draw,
    {
      shadowTraceCount: 16,
      paletteSize: settings.palette.length,
      colorPalette: settings.palette,
      enableHighDpiRendering: true,
      lightCutoffDistance: settings.lightCutoffDistance,
      textures: {
        noiseTexture: {
          source: noiseTexture,
          overrides: {
            maxFilter: FilteringOptions.LINEAR,
            wrapS: WrapOptions.MIRRORED_REPEAT,
            wrapT: WrapOptions.MIRRORED_REPEAT,
          },
        },
      },
    },
  );
