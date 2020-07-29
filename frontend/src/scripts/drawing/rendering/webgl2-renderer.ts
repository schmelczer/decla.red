import { mat2d, vec2 } from 'gl-matrix';
import { InfoText } from '../../objects/types/info-text';
import { DefaultFrameBuffer } from '../graphics-library/frame-buffer/default-frame-buffer';
import { IntermediateFrameBuffer } from '../graphics-library/frame-buffer/intermediate-frame-buffer';
import { WebGlStopwatch } from '../graphics-library/helper/stopwatch';
import { IProgram } from '../graphics-library/program/i-program';
import { UniformArrayAutoScalingProgram } from '../graphics-library/program/uniform-array-autoscaling-program';
import { IRenderer } from './i-renderer';
import { Circle } from '../primitives/circle';
import { IPrimitive } from '../primitives/i-primitive';
import { Rectangle } from '../primitives/rectangle';
import { TunnelShape } from '../primitives/tunnel-shape';
import { Autoscaler } from './autoscaler';
import { ILight } from '../lights/i-light';
import { toPercent } from '../../helper/to-percent';
import { exponentialDecay } from '../../helper/exponential-decay';
import { settings } from './settings';

export class WebGl2Renderer implements IRenderer {
  private gl: WebGL2RenderingContext;
  private qualityScaler: Autoscaler;
  private stopwatch?: WebGlStopwatch;

  private viewBox: Rectangle = new Rectangle();
  private viewCircle: Circle = new Circle();

  private cursorPosition = vec2.create();

  private distanceFieldFrameBuffer: IntermediateFrameBuffer;
  private lightingFrameBuffer: DefaultFrameBuffer;
  private distanceProgram: IProgram;
  private lightingProgram: IProgram;

  private primitives: Array<IPrimitive>;
  private lights: Array<ILight>;

  constructor(
    private canvas: HTMLCanvasElement,
    private overlay: HTMLElement,
    shaderSources: Array<[string, string]>
  ) {
    this.getContext();
    this.createPipeline(shaderSources);
    this.setupAutoscaling();

    try {
      this.stopwatch = new WebGlStopwatch(this.gl);
    } catch {}
  }

  private getContext() {
    this.gl = this.canvas.getContext('webgl2');
    if (!this.gl) {
      throw new Error('WebGl2 is not supported');
    }
  }

  private createPipeline(shaderSources: Array<[string, string]>) {
    const distanceScale = settings.shaderUniforms.distanceScale;

    this.distanceFieldFrameBuffer = new IntermediateFrameBuffer(this.gl);
    this.distanceProgram = new UniformArrayAutoScalingProgram(
      this.gl,
      shaderSources[0][0],
      shaderSources[0][1],
      { ...settings.shaderUniforms },
      {
        getValueFromUniforms: (v) => (v.lines ? v.lines.length / 2 : 0),
        uniformArraySizeName: 'lineCount',
        startingValue: 0,
        enablingMacro: 'linesEnabled',
        steps: 1,
        maximumValue: 15,
      }
    );

    this.lightingFrameBuffer = new DefaultFrameBuffer(this.gl);
    this.lightingProgram = new UniformArrayAutoScalingProgram(
      this.gl,
      shaderSources[1][0],
      shaderSources[1][1],
      { ...settings.shaderUniforms },
      {
        getValueFromUniforms: (v) => (v.lights ? v.lights.length : 0),
        uniformArraySizeName: 'lightCount',
        startingValue: 1,
        enablingMacro: null,
        steps: 1,
        maximumValue: 8,
      }
    );
  }

  private setupAutoscaling() {
    this.qualityScaler = new Autoscaler(
      [
        (v) => (this.lightingFrameBuffer.renderScale = v),
        (v) => (this.distanceFieldFrameBuffer.renderScale = v),
      ],
      settings.qualityScaling.scaleTargets,
      settings.qualityScaling.startingTargetIndex,
      settings.qualityScaling.scalingOptions
    );
  }

  private timeSinceLastAdjusment = 0;
  private exponentialDecayedDeltaTime = 0.0;
  private configureQuality(deltaTime: DOMHighResTimeStamp) {
    this.timeSinceLastAdjusment += deltaTime;
    if (
      this.timeSinceLastAdjusment >=
      settings.qualityScaling.adjusmentRateInMilliseconds
    ) {
      this.timeSinceLastAdjusment = 0;
      this.exponentialDecayedDeltaTime = exponentialDecay(
        this.exponentialDecayedDeltaTime,
        deltaTime,
        settings.qualityScaling.deltaTimeResponsiveness
      );

      if (
        this.exponentialDecayedDeltaTime <=
        settings.qualityScaling.targetDeltaTimeInMilliseconds -
          settings.qualityScaling.deltaTimeError
      ) {
        this.qualityScaler.increase();
      } else if (
        this.exponentialDecayedDeltaTime >
        settings.qualityScaling.targetDeltaTimeInMilliseconds +
          settings.qualityScaling.deltaTimeError
      ) {
        this.qualityScaler.decrease();
      }
    }

    InfoText.modifyRecord(
      'quality',
      `${toPercent(this.distanceFieldFrameBuffer.renderScale)}, ${toPercent(
        this.lightingFrameBuffer.renderScale
      )}`
    );
  }

  public drawPrimitive(primitive: IPrimitive) {
    this.primitives.push(primitive);
  }

  public drawLight(light: ILight) {
    this.lights.push(light);
  }

  public startFrame(deltaTime: DOMHighResTimeStamp): void {
    this.configureQuality(deltaTime);
    this.primitives = [];
    this.lights = [];

    this.stopwatch?.start();
    this.distanceFieldFrameBuffer.setSize();
    this.lightingFrameBuffer.setSize();
  }

  public finishFrame() {
    const uniforms: any = this.calculateOwnUniforms();

    this.lights.forEach((l) => l.serializeToUniforms(uniforms));

    this.distanceFieldFrameBuffer.bindAndClear();
    const q = 1 / settings.tileMultiplier;
    const uvSize = vec2.fromValues(q, q);

    const possiblyOnScreenPrimitives = this.primitives.filter(
      (p) => p.minimumDistance(this.viewCircle.center) < this.viewCircle.radius
    ) as Array<TunnelShape>;

    InfoText.modifyRecord(
      'nearby lines',
      possiblyOnScreenPrimitives.length.toString()
    );

    const origin = vec2.transformMat2d(
      vec2.create(),
      vec2.fromValues(0, 0),
      uniforms.uvToWorld
    );

    const firstCenter = vec2.transformMat2d(
      vec2.create(),
      vec2.fromValues(q, q),
      uniforms.uvToWorld
    );

    vec2.subtract(firstCenter, firstCenter, origin);

    const worldR = vec2.length(firstCenter);
    uniforms.maxMinDistance = 2 * worldR;

    let sumLineCount = 0;

    for (let x = 0; x < 1; x += q) {
      for (let y = 0; y < 1; y += q) {
        const uvBottomLeft = vec2.fromValues(x, y);
        this.distanceProgram.setDrawingRectangle(uvBottomLeft, uvSize);

        const tileCenterWorldCoordinates = vec2.transformMat2d(
          vec2.create(),
          vec2.add(vec2.create(), uvBottomLeft, vec2.fromValues(q, q)),
          uniforms.uvToWorld
        );

        const primitivesNearTile = possiblyOnScreenPrimitives.filter(
          (p) => p.distance(tileCenterWorldCoordinates) < 2 * worldR
        );

        sumLineCount += primitivesNearTile.length;

        uniforms.lines = [];
        uniforms.radii = [];

        primitivesNearTile.forEach((p) => p.serializeToUniforms(uniforms));

        this.distanceProgram.bindAndSetUniforms(uniforms);
        this.distanceProgram.draw();
      }
    }

    InfoText.modifyRecord(
      'lines',
      (
        sumLineCount /
        settings.tileMultiplier /
        settings.tileMultiplier
      ).toFixed(2)
    );

    this.lightingFrameBuffer.bindAndClear(
      this.distanceFieldFrameBuffer.colorTexture
    );
    this.lightingProgram.bindAndSetUniforms(uniforms);
    this.lightingProgram.draw();

    this.stopwatch?.stop();
  }

  private calculateOwnUniforms(): any {
    const distanceScreenToWorld = this.getScreenToWorldTransform(
      this.distanceFieldFrameBuffer.getSize()
    );

    const uvToWorld = mat2d.fromTranslation(
      mat2d.create(),
      this.viewBox.topLeft
    );
    mat2d.scale(uvToWorld, uvToWorld, this.viewBox.size);

    const worldToDistanceUV = mat2d.scale(
      mat2d.create(),
      distanceScreenToWorld,
      this.distanceFieldFrameBuffer.getSize()
    );
    mat2d.invert(worldToDistanceUV, worldToDistanceUV);

    const ndcToUv = mat2d.fromScaling(
      mat2d.create(),
      vec2.fromValues(0.5, 0.5)
    );
    mat2d.translate(ndcToUv, ndcToUv, vec2.fromValues(1, 1));

    const cursorPosition = this.screenUvToWorldCoordinate(this.cursorPosition);

    return {
      distanceScreenToWorld,
      worldToDistanceUV,
      cursorPosition,
      ndcToUv,
      uvToWorld,
      viewBoxSize: this.viewBox.size,
    };
  }

  private getScreenToWorldTransform(screenSize: vec2) {
    const transform = mat2d.fromTranslation(
      mat2d.create(),
      this.viewBox.topLeft
    );
    mat2d.scale(
      transform,
      transform,
      vec2.divide(vec2.create(), this.viewBox.size, screenSize)
    );
    mat2d.translate(transform, transform, vec2.fromValues(0.5, 0.5));

    return transform;
  }

  public screenUvToWorldCoordinate(screenUvPosition: vec2): vec2 {
    const resolution = vec2.fromValues(this.canvas.width, this.canvas.height);

    return vec2.transformMat2d(
      vec2.create(),
      vec2.multiply(vec2.create(), screenUvPosition, resolution),
      this.getScreenToWorldTransform(resolution)
    );
  }

  public setCameraPosition(position: vec2) {
    this.viewBox.topLeft = position;
    const halfDiagonal = vec2.scale(vec2.create(), this.viewBox.size, 0.5);
    this.viewCircle.center = vec2.add(
      vec2.create(),
      this.viewBox.topLeft,
      halfDiagonal
    );
  }

  public setCursorPosition(position: vec2): void {
    this.cursorPosition = position;
  }

  public setInViewArea(size: number): vec2 {
    const canvasAspectRatio =
      this.canvas.clientWidth / this.canvas.clientHeight;

    this.viewBox.size = vec2.fromValues(
      Math.sqrt(size * canvasAspectRatio),
      Math.sqrt(size / canvasAspectRatio)
    );

    const halfDiagonal = vec2.scale(vec2.create(), this.viewBox.size, 0.5);

    this.viewCircle.center = vec2.add(
      vec2.create(),
      this.viewBox.topLeft,
      halfDiagonal
    );
    this.viewCircle.radius = vec2.length(halfDiagonal);

    return this.viewBox.size;
  }

  public drawInfoText(text: string) {
    if (this.overlay.innerText != text) {
      this.overlay.innerText = text;
    }
  }
}
