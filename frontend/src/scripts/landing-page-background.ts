import { ReadonlyVec2, vec2, vec3 } from 'gl-matrix';
import {
  CircleLight,
  FilteringOptions,
  Renderer,
  renderNoise,
  runAnimation,
  WrapOptions,
} from 'sdf-2d';
import { settings, PlanetBase, Random, hsl } from 'shared';
import { PlanetShape } from './shapes/planet-shape';

const bluePlanet = 0;
const redPlanet = 0.85;

export class LandingPageBackground {
  public readonly renderer: Promise<Renderer>;

  private isActive = true;
  private resolveRenderer!: (r: Renderer) => unknown;
  private scene?: {
    canvasSize: vec2;
    topPlanet: PlanetShape;
    bottomPlanet: PlanetShape;
    planetAngle: number;
    planetDistance: number;
  };

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Promise((r) => (this.resolveRenderer = r));
    this.start(canvas);
  }

  private async start(canvas: HTMLCanvasElement): Promise<void> {
    const noiseTexture = await renderNoise([256, 256], 1.2, 2);

    runAnimation(
      canvas,
      [
        { ...PlanetShape.descriptor, shaderCombinationSteps: [0, 1, 2] },
        { ...CircleLight.descriptor, shaderCombinationSteps: [0, 2] },
      ],
      this.gameLoop.bind(this),
      {
        shadowTraceCount: 16,
        paletteSize: 1,
        ambientLight: vec3.fromValues(0, 0, 0),
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
  }

  private buildScene(canvasSize: ReadonlyVec2) {
    Random.seed = 42;

    const topPosition = vec2.scale(vec2.create(), canvasSize, 0.7);
    const topPlanet = new PlanetShape(
      PlanetBase.createPlanetVertices(
        topPosition,
        Random.getRandomInRange(150, 400),
        Random.getRandomInRange(150, 400),
        Random.getRandomInRange(10, 20),
      ),
      redPlanet,
    );
    topPlanet.randomOffset = Random.getRandom();

    const bottomPosition = vec2.scale(vec2.create(), canvasSize, 0.3);
    const bottomPlanet = new PlanetShape(
      PlanetBase.createPlanetVertices(
        bottomPosition,
        Random.getRandomInRange(150, 800),
        Random.getRandomInRange(150, 400),
        Random.getRandomInRange(10, 40),
      ),
      bluePlanet,
    );
    bottomPlanet.randomOffset = Random.getRandom();

    const between = vec2.subtract(vec2.create(), topPosition, bottomPosition);
    this.scene = {
      canvasSize: vec2.clone(canvasSize),
      topPlanet,
      bottomPlanet,
      planetAngle: Math.atan2(between[1], between[0]),
      planetDistance: vec2.length(between),
    };
    return this.scene;
  }

  private gameLoop(renderer: Renderer, time: DOMHighResTimeStamp): boolean {
    this.resolveRenderer(renderer);
    renderer.setViewArea(vec2.fromValues(0, renderer.canvasSize[1]), renderer.canvasSize);

    const scene =
      this.scene && vec2.exactEquals(this.scene.canvasSize, renderer.canvasSize)
        ? this.scene
        : this.buildScene(renderer.canvasSize);

    scene.topPlanet.rotation = (time / 1000) * 0.09;
    scene.bottomPlanet.rotation = (time / 1000) * -0.06;
    renderer.addDrawable(scene.topPlanet);
    renderer.addDrawable(scene.bottomPlanet);

    const lightDistance = scene.planetDistance * 1.2;
    renderer.addDrawable(
      new CircleLight(
        this.calculateLightPosition(
          renderer,
          scene.planetAngle,
          lightDistance,
          -time / 3000,
        ),
        hsl(25, 75, 60),
        0.75,
      ),
    );
    renderer.addDrawable(
      new CircleLight(
        this.calculateLightPosition(
          renderer,
          scene.planetAngle,
          lightDistance,
          time / 2000 + Math.PI,
        ),
        hsl(249, 79, 70),
        0.25,
      ),
    );

    return this.isActive;
  }

  private calculateLightPosition(
    renderer: Renderer,
    angle: number,
    length: number,
    t: number,
  ): vec2 {
    const lightPosition = vec2.fromValues(
      length * Math.sin(t),
      length * Math.sin(t) * Math.cos(t),
    );
    const canvasCenter = vec2.scale(vec2.create(), renderer.canvasSize, 0.5);
    vec2.add(lightPosition, lightPosition, canvasCenter);
    return vec2.rotate(lightPosition, lightPosition, canvasCenter, angle);
  }

  public destroy() {
    this.isActive = false;
  }
}
