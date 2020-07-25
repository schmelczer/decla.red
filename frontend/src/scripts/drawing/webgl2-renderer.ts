import { mat2d, vec2 } from 'gl-matrix';
import { clamp } from '../helper/clamp';
import { Rectangle } from '../math/rectangle';
import { InfoText } from '../objects/types/info-text';
import { Drawer } from './drawer';
import { DefaultFrameBuffer } from './graphics-library/default-frame-buffer';
import { FragmentShaderOnlyProgram } from './graphics-library/fragment-shader-only-program';
import { IntermediateFrameBuffer } from './graphics-library/intermediate-frame-buffer';
import { WebGlStopwatch } from './graphics-library/stopwatch';

export class WebGl2Renderer implements Drawer {
  private gl: WebGL2RenderingContext;
  private stopwatch?: WebGlStopwatch;

  private viewBox: Rectangle = new Rectangle();
  private uniforms: any;
  private cursorPosition = vec2.create();
  private distanceFieldFrameBuffer: IntermediateFrameBuffer;
  private lightingFrameBuffer: DefaultFrameBuffer;

  private targetDeltaTime = (1 / 50) * 1000;
  private deltaTimeError = (1 / 1000) * 1000;
  private additiveQualityIncrease = 0.05;
  private multiplicativeQualityDecrease = 1.5;
  private timeSinceLastAdjusment = 0;
  private adjusmentRate = 500;
  private maxRenderScale = 2;
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
        this.additiveQualityIncrease / 2;
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
      this.minRenderScale,
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

    this.distanceFieldFrameBuffer = new IntermediateFrameBuffer(this.gl, [
      new FragmentShaderOnlyProgram(this.gl, ...shaderSources[0]),
    ]);

    this.lightingFrameBuffer = new DefaultFrameBuffer(this.gl, [
      new FragmentShaderOnlyProgram(this.gl, ...shaderSources[1]),
    ]);

    this.distanceFieldFrameBuffer.renderScale = 0.5;
    this.lightingFrameBuffer.renderScale = 1;

    try {
      this.stopwatch = new WebGlStopwatch(this.gl);
    } catch {}
  }

  public startFrame(deltaTime: DOMHighResTimeStamp): void {
    this.configureRenderScale(deltaTime);

    this.stopwatch?.start();
    this.uniforms = {};
    this.distanceFieldFrameBuffer.setSize();
    this.lightingFrameBuffer.setSize();
  }

  public finishFrame() {
    this.calculateOwnUniforms();

    this.distanceFieldFrameBuffer.render(this.uniforms);
    this.lightingFrameBuffer.render(
      this.uniforms,
      this.distanceFieldFrameBuffer.colorTexture
    );

    this.stopwatch?.stop();
  }

  private calculateOwnUniforms() {
    const distanceScreenToWorld = this.getScreenToWorldTransform(
      this.distanceFieldFrameBuffer.getSize()
    );

    const ndcToWorld = mat2d.fromTranslation(
      mat2d.create(),
      this.viewBox.topLeft
    );
    mat2d.scale(ndcToWorld, ndcToWorld, this.viewBox.size);
    mat2d.scale(ndcToWorld, ndcToWorld, vec2.fromValues(0.5, 0.5));
    mat2d.translate(ndcToWorld, ndcToWorld, vec2.fromValues(1, 1));

    const worldToDistanceUV = mat2d.scale(
      mat2d.create(),
      distanceScreenToWorld,
      this.distanceFieldFrameBuffer.getSize()
    );
    mat2d.invert(worldToDistanceUV, worldToDistanceUV);

    const cursorPosition = this.screenUvToWorldCoordinate(this.cursorPosition);

    this.giveUniforms({
      distanceScreenToWorld,
      worldToDistanceUV,
      cursorPosition,
      ndcToWorld,
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
    return this.viewBox.size;
  }

  public drawInfoText(text: string) {
    if (this.overlay.innerText != text) {
      this.overlay.innerText = text;
    }
  }

  public isOnScreen(position: vec2): boolean {
    return this.viewBox.isInside(position);
  }
}
