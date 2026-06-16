import { vec2 } from 'gl-matrix';
import {
  CircleLight,
  FilteringOptions,
  hsl,
  Renderer,
  renderNoise,
  runAnimation,
  WrapOptions,
} from 'sdf-2d';
import { settings, rgb, PlanetBase, Random } from 'shared';
import { PlanetShape } from './shapes/planet-shape';

// colorMixQ ends of PlanetShape's blue<->red gradient, so the two backdrop
// planets read as the two in-game teams.
const bluePlanet = 0;
const redPlanet = 1;

export class LandingPageBackground {
  private isActive = true;
  public renderer: Promise<Renderer>;
  private resolveRenderer!: (r: Renderer) => unknown;

  constructor(canvas: HTMLCanvasElement) {
    this.start(canvas);
    this.renderer = new Promise((r) => (this.resolveRenderer = r));
  }

  private async start(canvas: HTMLCanvasElement): Promise<void> {
    const noiseTexture = await renderNoise([256, 256], 1.2, 2);

    runAnimation(
      canvas,
      [
        {
          ...PlanetShape.descriptor,
          shaderCombinationSteps: [0, 1, 2],
        },
        {
          ...CircleLight.descriptor,
          shaderCombinationSteps: [0, 2],
        },
      ],
      this.gameLoop.bind(this),
      {
        shadowTraceCount: 16,
        paletteSize: 1,
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
      },
    );
  }

  private gameLoop(renderer: Renderer, time: DOMHighResTimeStamp, _: number): boolean {
    Random.seed = 42;

    this.resolveRenderer(renderer);

    renderer.setViewArea(vec2.fromValues(0, renderer.canvasSize.y), renderer.canvasSize);

    const topPlanetPosition = vec2.fromValues(
      0.7 * renderer.canvasSize.x,
      0.7 * renderer.canvasSize.y,
    );

    const topPlanet = new PlanetShape(
      PlanetBase.createPlanetVertices(
        topPlanetPosition,
        Random.getRandomInRange(150, 400),
        Random.getRandomInRange(150, 400),
        Random.getRandomInRange(10, 20),
      ),
      redPlanet,
    );

    // Fixed terrain phase (no longer animated -> no pulsing); the planet spins
    // instead, the same way in-game planets do: PlanetShape's rotation uniform
    // turns the whole body, terrain and outline together, in its own frame.
    // Speeds sit in the game's per-planet range (~0.05-0.12 rad/s) and
    // counter-rotate so the two planets don't drift in lockstep.
    topPlanet.randomOffset = Random.getRandom();
    topPlanet.rotation = (time / 1000) * 0.09;

    const bottomPlanetPosition = vec2.fromValues(
      0.3 * renderer.canvasSize.x,
      0.3 * renderer.canvasSize.y,
    );

    const bottomPlanet = new PlanetShape(
      PlanetBase.createPlanetVertices(
        bottomPlanetPosition,
        Random.getRandomInRange(150, 800),
        Random.getRandomInRange(150, 400),
        Random.getRandomInRange(10, 40),
      ),
      bluePlanet,
    );

    bottomPlanet.randomOffset = Random.getRandom();
    bottomPlanet.rotation = (time / 1000) * -0.06;

    const planetDistance = vec2.subtract(
      vec2.create(),
      topPlanetPosition,
      bottomPlanetPosition,
    );
    const planetDistanceLength = vec2.length(planetDistance);
    const planetDirection = vec2.normalize(planetDistance, planetDistance);
    const planetAngle = Math.atan2(planetDirection.y, planetDirection.x);

    renderer.addDrawable(topPlanet);
    renderer.addDrawable(bottomPlanet);
    renderer.addDrawable(
      new CircleLight(
        this.calculateLightPosition(
          renderer,
          planetAngle,
          planetDistanceLength * 1.2,
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
          planetAngle,
          planetDistanceLength * 1.2,
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
    vec2.rotate(lightPosition, lightPosition, canvasCenter, angle);
    return lightPosition;
  }

  public destroy() {
    this.isActive = false;
  }
}
