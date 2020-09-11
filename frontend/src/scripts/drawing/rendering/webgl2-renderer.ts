import { mat2d, vec2 } from 'gl-matrix';
import { BoundingBoxBase } from '../../shapes/bounding-box-base';
import { DrawableBlob } from '../drawables/drawable-blob';
import { DrawableTunnel } from '../drawables/drawable-tunnel';
import { IDrawable } from '../drawables/i-drawable';
import { CircleLight } from '../drawables/lights/circle-light';
import { ILight } from '../drawables/lights/i-light';
import { PointLight } from '../drawables/lights/point-light';
import { DefaultFrameBuffer } from '../graphics-library/frame-buffer/default-frame-buffer';
import { IntermediateFrameBuffer } from '../graphics-library/frame-buffer/intermediate-frame-buffer';
import { getWebGl2Context } from '../graphics-library/helper/get-webgl2-context';
import { WebGlStopwatch } from '../graphics-library/helper/stopwatch';
import { IRenderer } from '../i-renderer';
import caveFragmentShader from '../shaders/cave-distance-fs.glsl';
import lightsFragmentShader from '../shaders/lights-shading-fs.glsl';
import caveVertexShader from '../shaders/passthrough-distance-vs.glsl';
import lightsVertexShader from '../shaders/passthrough-shading-vs.glsl';
import { FpsAutoscaler } from './fps-autoscaler';
import { RenderingPass } from './rendering-pass';

export class WebGl2Renderer implements IRenderer {
  private gl: WebGL2RenderingContext;
  private stopwatch?: WebGlStopwatch;

  private scaleWorldToNDC = mat2d.create();
  private scaleWorldAreaInViewToNDC = 1;

  private viewAreaBottomLeft = vec2.create();
  private worldAreaInView = vec2.create();
  private squareToAspectRatio: vec2;
  private uvToWorld: mat2d;
  private cursorPosition = vec2.create();

  private distanceFieldFrameBuffer: IntermediateFrameBuffer;
  private lightingFrameBuffer: DefaultFrameBuffer;
  private distancePass: RenderingPass;
  private lightingPass: RenderingPass;
  private autoscaler: FpsAutoscaler;

  private initializePromise: Promise<[void, void]> = null;

  private softShadowsEnabled: boolean;

  constructor(private canvas: HTMLCanvasElement, private overlay: HTMLElement) {
    this.gl = getWebGl2Context(canvas);

    this.distanceFieldFrameBuffer = new IntermediateFrameBuffer(this.gl);
    this.lightingFrameBuffer = new DefaultFrameBuffer(this.gl);

    this.distancePass = new RenderingPass(
      this.gl,
      [caveVertexShader, caveFragmentShader],
      [DrawableTunnel.descriptor, DrawableBlob.descriptor],
      this.distanceFieldFrameBuffer
    );

    this.lightingPass = new RenderingPass(
      this.gl,
      [lightsVertexShader, lightsFragmentShader],
      [CircleLight.descriptor, PointLight.descriptor],
      this.lightingFrameBuffer
    );

    this.initializePromise = Promise.all([
      this.distancePass.initialize(),
      this.lightingPass.initialize(),
    ]);

    this.autoscaler = new FpsAutoscaler({
      distanceRenderScale: (v) =>
        (this.distanceFieldFrameBuffer.renderScale = v as number),
      finalRenderScale: (v) => (this.lightingFrameBuffer.renderScale = v as number),
      softShadowsEnabled: (v) => (this.softShadowsEnabled = v as boolean),
    });

    try {
      this.stopwatch = new WebGlStopwatch(this.gl);
    } catch {
      // no problem
    }
  }

  public async initialize(): Promise<void> {
    await this.initializePromise;
  }

  public drawShape(shape: IDrawable) {
    this.distancePass.addDrawable(shape);
  }

  public drawLight(light: ILight) {
    this.lightingPass.addDrawable(light);
  }

  public startFrame(deltaTime: DOMHighResTimeStamp) {
    this.autoscaler.autoscale(deltaTime);

    this.stopwatch?.start();

    this.distanceFieldFrameBuffer.setSize();
    this.lightingFrameBuffer.setSize();
  }

  public finishFrame() {
    this.calculateMatrices();

    this.distancePass.render(
      this.uniforms,
      this.scaleWorldAreaInViewToNDC,
      this.scaleWorldToNDC
    );
    this.lightingPass.render(
      this.uniforms,
      this.scaleWorldAreaInViewToNDC,
      this.scaleWorldToNDC,
      this.distanceFieldFrameBuffer.colorTexture
    );

    this.stopwatch?.stop();
  }

  private get uniforms(): any {
    const cursorPosition = this.uvToWorldCoordinate(this.cursorPosition);
    return {
      cursorPosition,
      pixelSize:
        (4.5 * this.scaleWorldAreaInViewToNDC) /
        this.distanceFieldFrameBuffer.renderScale,
      uvToWorld: this.uvToWorld,
      worldAreaInView: this.worldAreaInView,
      squareToAspectRatio: this.squareToAspectRatio,
      softShadowsEnabled: this.softShadowsEnabled,
    };
  }

  private calculateMatrices() {
    this.uvToWorld = mat2d.fromTranslation(mat2d.create(), this.viewAreaBottomLeft);
    mat2d.scale(this.uvToWorld, this.uvToWorld, this.worldAreaInView);
  }

  private getScreenToWorldTransform(screenSize: vec2) {
    const transform = mat2d.fromTranslation(mat2d.create(), this.viewAreaBottomLeft);
    mat2d.scale(
      transform,
      transform,
      vec2.divide(vec2.create(), this.worldAreaInView, screenSize)
    );
    mat2d.translate(transform, transform, vec2.fromValues(0.5, 0.5));

    return transform;
  }

  public uvToWorldCoordinate(screenUvPosition: vec2): vec2 {
    const resolution = vec2.fromValues(this.canvas.width, this.canvas.height);

    return vec2.transformMat2d(
      vec2.create(),
      vec2.multiply(vec2.create(), screenUvPosition, resolution),
      this.getScreenToWorldTransform(resolution)
    );
  }

  public get canvasSize(): vec2 {
    return vec2.fromValues(this.canvas.clientWidth, this.canvas.clientHeight);
  }

  public setViewArea(viewArea: BoundingBoxBase) {
    this.worldAreaInView = viewArea.size;

    // world coordinates
    this.viewAreaBottomLeft = vec2.add(
      vec2.create(),
      viewArea.topLeft,
      vec2.fromValues(0, -viewArea.size.y)
    );

    const scaleLongerEdgeTo1 =
      1 / Math.max(this.worldAreaInView.x, this.worldAreaInView.y);

    this.squareToAspectRatio = vec2.fromValues(
      this.worldAreaInView.x * scaleLongerEdgeTo1,
      this.worldAreaInView.y * scaleLongerEdgeTo1
    );

    this.scaleWorldAreaInViewToNDC = scaleLongerEdgeTo1 * 2;

    mat2d.fromScaling(
      this.scaleWorldToNDC,
      vec2.fromValues(this.scaleWorldAreaInViewToNDC, this.scaleWorldAreaInViewToNDC)
    );
    const translate = vec2.scale(vec2.create(), this.viewAreaBottomLeft, -1);
    vec2.subtract(
      translate,
      translate,
      vec2.scale(vec2.create(), this.worldAreaInView, 0.5)
    );
    mat2d.translate(this.scaleWorldToNDC, this.scaleWorldToNDC, translate);
  }

  public setCursorPosition(position: vec2): void {
    this.cursorPosition = position;
  }

  public drawInfoText(text: string) {
    if (this.overlay.innerText != text) {
      this.overlay.innerText = text;
    }
  }
}
