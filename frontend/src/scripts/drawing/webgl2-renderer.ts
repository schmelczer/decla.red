import { mat2d, vec2 } from 'gl-matrix';
import { clamp } from '../helper/clamp';
import { InfoText } from '../objects/types/info-text';
import { DefaultFrameBuffer } from './graphics-library/frame-buffer/default-frame-buffer';
import { IntermediateFrameBuffer } from './graphics-library/frame-buffer/intermediate-frame-buffer';
import { WebGlStopwatch } from './graphics-library/helper/stopwatch';
import { IProgram } from './graphics-library/program/i-program';
import { UniformArrayAutoScalingProgram } from './graphics-library/program/uniform-array-autoscaling-program';
import { IRenderer } from './i-renderer';
import { Circle } from './primitives/circle';
import { IPrimitive } from './primitives/i-primitive';
import { Rectangle } from './primitives/rectangle';
import { TunnelShape } from './primitives/tunnel-shape';

export class WebGl2Renderer implements IRenderer {
  private gl: WebGL2RenderingContext;
  private stopwatch?: WebGlStopwatch;

  private viewBox: Rectangle = new Rectangle();
  private viewCircle: Circle = new Circle(vec2.create(), 0);
  private uniforms: any;
  private cursorPosition = vec2.create();
  private distanceFieldFrameBuffer: IntermediateFrameBuffer;
  private lightingFrameBuffer: DefaultFrameBuffer;
  private distanceProgram: IProgram;
  private lightingProgram: IProgram;

  private primitives: Array<IPrimitive>;

  private tileMultiplier = 5;

  private targetDeltaTime = (1 / 30) * 1000;
  private deltaTimeError = (1 / 1000) * 1000;
  private additiveQualityIncrease = 0.03;
  private multiplicativeQualityDecrease = 1.2;
  private timeSinceLastAdjusment = 0;
  private adjusmentRate = 300;
  private maxRenderScale = 1.5;
  private minRenderScale = 0.2;

  private exponentialDecayedDeltaTime = 0.0;

  private configureRenderScale(deltaTime: DOMHighResTimeStamp) {
    this.timeSinceLastAdjusment += deltaTime;
    if (this.timeSinceLastAdjusment < this.adjusmentRate) {
      return;
    }
    this.timeSinceLastAdjusment = 0;

    this.exponentialDecayedDeltaTime =
      (15 / 16) * this.exponentialDecayedDeltaTime + deltaTime / 16;

    if (
      this.exponentialDecayedDeltaTime <=
      this.targetDeltaTime - this.deltaTimeError
    ) {
      this.distanceFieldFrameBuffer.renderScale +=
        this.additiveQualityIncrease / 3;
      this.lightingFrameBuffer.renderScale += this.additiveQualityIncrease;
    } else if (
      this.exponentialDecayedDeltaTime >
      this.targetDeltaTime + this.deltaTimeError
    ) {
      this.distanceFieldFrameBuffer.renderScale /= this.multiplicativeQualityDecrease;
      this.lightingFrameBuffer.renderScale /= this.multiplicativeQualityDecrease;
    }

    this.distanceFieldFrameBuffer.renderScale = clamp(
      this.distanceFieldFrameBuffer.renderScale,
      0.1,
      this.maxRenderScale
    );
    this.lightingFrameBuffer.renderScale = clamp(
      this.lightingFrameBuffer.renderScale,
      this.minRenderScale,
      this.maxRenderScale
    );

    InfoText.modifyRecord(
      'dt decay',
      this.exponentialDecayedDeltaTime.toFixed(2)
    );
    InfoText.modifyRecord(
      'q1',
      this.distanceFieldFrameBuffer.renderScale.toFixed(2)
    );
    InfoText.modifyRecord(
      'q2',
      this.lightingFrameBuffer.renderScale.toFixed(2)
    );
  }

  constructor(
    private canvas: HTMLCanvasElement,
    private overlay: HTMLElement,
    shaderSources: Array<[string, string]>
  ) {
    this.gl = this.canvas.getContext('webgl2');
    if (!this.gl) {
      throw new Error('WebGl2 is not supported');
    }

    this.createPipeline(shaderSources);

    this.distanceFieldFrameBuffer.renderScale = 0.5;
    this.lightingFrameBuffer.renderScale = 1;

    try {
      this.stopwatch = new WebGlStopwatch(this.gl);
    } catch {}
  }

  private createPipeline(shaderSources: Array<[string, string]>) {
    const distanceScale = 64;

    this.distanceFieldFrameBuffer = new IntermediateFrameBuffer(this.gl);
    this.distanceProgram = new UniformArrayAutoScalingProgram(
      this.gl,
      shaderSources[0][0],
      shaderSources[0][1],
      { distanceScale },
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
      { distanceScale },
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

  public drawPrimitive(primitive: IPrimitive) {
    this.primitives.push(primitive);
  }

  public startFrame(deltaTime: DOMHighResTimeStamp): void {
    this.configureRenderScale(deltaTime);
    this.primitives = [];

    this.stopwatch?.start();
    this.uniforms = {};
    this.distanceFieldFrameBuffer.setSize();
    this.lightingFrameBuffer.setSize();
  }

  public finishFrame() {
    this.calculateOwnUniforms();

    this.distanceFieldFrameBuffer.bindAndClear();
    const q = 1 / this.tileMultiplier;
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
      this.uniforms.uvToWorld
    );

    const firstCenter = vec2.transformMat2d(
      vec2.create(),
      vec2.fromValues(q, q),
      this.uniforms.uvToWorld
    );

    vec2.subtract(firstCenter, firstCenter, origin);

    const worldR = vec2.length(firstCenter);
    this.uniforms.maxMinDistance = 2 * worldR;

    let sumLineCount = 0;

    for (let x = 0; x < 1; x += q) {
      for (let y = 0; y < 1; y += q) {
        const uvBottomLeft = vec2.fromValues(x, y);
        this.distanceProgram.setDrawingRectangle(uvBottomLeft, uvSize);

        const tileCenterWorldCoordinates = vec2.transformMat2d(
          vec2.create(),
          vec2.add(vec2.create(), uvBottomLeft, vec2.fromValues(q, q)),
          this.uniforms.uvToWorld
        );

        const primitivesNearTile = possiblyOnScreenPrimitives.filter(
          (p) => p.distance(tileCenterWorldCoordinates) < 2 * worldR
        );

        sumLineCount += primitivesNearTile.length;

        this.uniforms.lines = [];
        this.uniforms.radii = [];

        for (let tunnel of primitivesNearTile) {
          this.uniforms.lines.push(tunnel.from);
          this.uniforms.lines.push(tunnel.toFromDelta);
          this.uniforms.radii.push(tunnel.fromRadius);
          this.uniforms.radii.push(tunnel.toRadius);
        }

        this.distanceProgram.bindAndSetUniforms(this.uniforms);
        this.distanceProgram.draw();
      }
    }

    InfoText.modifyRecord(
      'lines',
      (sumLineCount / this.tileMultiplier / this.tileMultiplier).toFixed(2)
    );

    this.lightingFrameBuffer.bindAndClear(
      this.distanceFieldFrameBuffer.colorTexture
    );
    this.lightingProgram.bindAndSetUniforms(this.uniforms);
    this.lightingProgram.draw();

    this.stopwatch?.stop();
  }

  private calculateOwnUniforms() {
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

    this.giveUniforms({
      distanceScreenToWorld,
      worldToDistanceUV,
      cursorPosition,
      ndcToUv,
      uvToWorld,
      viewBoxSize: this.viewBox.size,
    });
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
  }

  public setCursorPosition(position: vec2): void {
    this.cursorPosition = position;
  }

  public appendToUniformList(listName: string, ...values: any[]): void {
    if (!this.uniforms.hasOwnProperty(listName)) {
      this.uniforms[listName] = [];
    }

    for (let value of values) {
      this.uniforms[listName].push(value);
    }
  }

  public giveUniforms(uniforms: any): void {
    this.uniforms = { ...this.uniforms, ...uniforms };
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

  public isOnScreen(boundingCircle: Circle): boolean {
    return this.viewCircle.areIntersecting(boundingCircle);
  }

  public isPositionOnScreen(position: vec2): boolean {
    return this.viewCircle.isInside(position);
  }
}
