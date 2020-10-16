import { vec2 } from 'gl-matrix';
import {
  CircleLight,
  compile,
  FilteringOptions,
  hsl,
  NoisyPolygonFactory,
  Renderer,
  renderNoise,
  WrapOptions,
} from 'sdf-2d';
import { settings, rgb, PlanetBase, Random } from 'shared';

const landingPageVertexCount = 9;
const LangindPagePolygon = NoisyPolygonFactory(
  landingPageVertexCount,
  rgb(0.5, 0.4, 0.7),
);

export class LandingPageBackground {
  private readonly canvas = document.querySelector('canvas') as HTMLCanvasElement;
  private renderer!: Renderer;

  constructor() {
    this.start();
  }

  private async start(): Promise<void> {
    const noiseTexture = await renderNoise([256, 256], 1.2, 2);

    this.renderer = await compile(
      this.canvas,
      [
        {
          ...LangindPagePolygon.descriptor,
          shaderCombinationSteps: [0, 1, 2],
        },
        {
          ...CircleLight.descriptor,
          shaderCombinationSteps: [0, 2],
        },
      ],
      {
        shadowTraceCount: 16,
        paletteSize: 1,
      },
    );

    this.renderer.setRuntimeSettings({
      ambientLight: rgb(0, 0, 0),
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
    });

    requestAnimationFrame(this.gameLoop.bind(this));
  }

  public destroy() {
    this.renderer.destroy();
  }

  private gameLoop(time: DOMHighResTimeStamp) {
    Random.seed = 42;

    this.renderer.setViewArea(
      vec2.fromValues(0, this.renderer.canvasSize.y),
      this.renderer.canvasSize,
    );

    const topPlanetPosition = vec2.fromValues(
      0.7 * this.renderer.canvasSize.x,
      0.7 * this.renderer.canvasSize.y,
    );

    const topPlanet = new LangindPagePolygon(
      PlanetBase.createPlanetVertices(
        topPlanetPosition,
        Random.getRandomInRange(150, 400),
        Random.getRandomInRange(150, 400),
        Random.getRandomInRange(10, 20),
        landingPageVertexCount,
      ),
    );

    (topPlanet as any).randomOffset = 0.5 + time / 3500;

    const bottomPlanetPosition = vec2.fromValues(
      0.3 * this.renderer.canvasSize.x,
      0.3 * this.renderer.canvasSize.y,
    );

    const bottomPlanet = new LangindPagePolygon(
      PlanetBase.createPlanetVertices(
        bottomPlanetPosition,
        Random.getRandomInRange(150, 800),
        Random.getRandomInRange(150, 400),
        Random.getRandomInRange(10, 40),
        landingPageVertexCount,
      ),
    );

    (bottomPlanet as any).randomOffset = time / 2500;

    const planetDistance = vec2.subtract(
      vec2.create(),
      topPlanetPosition,
      bottomPlanetPosition,
    );
    const planetDistanceLength = vec2.length(planetDistance);
    const planetDirection = vec2.normalize(planetDistance, planetDistance);
    const planetAngle = Math.atan2(planetDirection.y, planetDirection.x);

    this.renderer.addDrawable(topPlanet);
    this.renderer.addDrawable(bottomPlanet);
    this.renderer.addDrawable(
      new CircleLight(
        this.calculateLightPosition(
          planetAngle,
          planetDistanceLength * 1.2,
          -time / 3000,
        ),
        hsl(25, 75, 60),
        0.75,
      ),
    );

    this.renderer.addDrawable(
      new CircleLight(
        this.calculateLightPosition(
          planetAngle,
          planetDistanceLength * 1.2,
          time / 2000 + Math.PI,
        ),
        hsl(249, 79, 70),
        0.25,
      ),
    );

    this.renderer.renderDrawables();

    requestAnimationFrame(this.gameLoop.bind(this));
  }

  private calculateLightPosition(angle: number, length: number, t: number): vec2 {
    const lightPosition = vec2.fromValues(
      length * Math.sin(t),
      length * Math.sin(t) * Math.cos(t),
    );

    const canvasCenter = vec2.scale(vec2.create(), this.renderer.canvasSize, 0.5);

    vec2.add(lightPosition, lightPosition, canvasCenter);
    vec2.rotate(lightPosition, lightPosition, canvasCenter, angle);
    return lightPosition;
  }
}
