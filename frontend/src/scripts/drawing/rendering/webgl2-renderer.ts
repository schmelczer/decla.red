import { mat2d, vec2 } from 'gl-matrix';
import { BoundingBoxBase } from '../../shapes/bounding-box-base';
import { DrawableBlob } from '../drawables/drawable-blob';
import { DrawableTunnel } from '../drawables/drawable-tunnel';
import { IDrawable } from '../drawables/i-drawable';
import { CircleLight } from '../drawables/lights/circle-light';
import { ILight } from '../drawables/lights/i-light';
import { PointLight } from '../drawables/lights/point-light';
// import lightsShader from '../shaders/rainbow-shading-fs.glsl';
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

  private viewBoxBottomLeft = vec2.create();

  private viewBoxSize = vec2.create();

  private cursorPosition = vec2.create();

  private distanceFieldFrameBuffer: IntermediateFrameBuffer;

  private lightingFrameBuffer: DefaultFrameBuffer;

  private distancePass: RenderingPass;

  private lightingPass: RenderingPass;

  private autoscaler: FpsAutoscaler;

  private matrices: {
    distanceScreenToWorld?: mat2d;
    worldToDistanceUV?: mat2d;
    cursorPosition?: mat2d;
    ndcToUv?: mat2d;
    uvToWorld?: mat2d;
  } = { ndcToUv: mat2d.fromValues(0.5, 0, 0, 0.5, 0.5, 0.5) };

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

    this.autoscaler = new FpsAutoscaler([
      this.lightingFrameBuffer,
      this.distanceFieldFrameBuffer,
    ]);

    try {
      this.stopwatch = new WebGlStopwatch(this.gl);
    } catch {
      // no problem
    }
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

    this.distancePass.render(this.uniforms);

    this.lightingPass.render(this.uniforms, this.distanceFieldFrameBuffer.colorTexture);

    this.stopwatch?.stop();
  }

  private get uniforms(): any {
    const cursorPosition = this.screenUvToWorldCoordinate(this.cursorPosition);
    return { ...this.matrices, cursorPosition, viewBoxSize: this.viewBoxSize };
  }

  private calculateMatrices() {
    this.matrices.uvToWorld = mat2d.fromTranslation(
      mat2d.create(),
      this.viewBoxBottomLeft
    );
    mat2d.scale(this.matrices.uvToWorld, this.matrices.uvToWorld, this.viewBoxSize);

    this.matrices.distanceScreenToWorld = this.getScreenToWorldTransform(
      this.distanceFieldFrameBuffer.getSize()
    );

    this.matrices.worldToDistanceUV = mat2d.scale(
      mat2d.create(),
      this.matrices.distanceScreenToWorld,
      this.distanceFieldFrameBuffer.getSize()
    );
    mat2d.invert(this.matrices.worldToDistanceUV, this.matrices.worldToDistanceUV);
  }

  private getScreenToWorldTransform(screenSize: vec2) {
    const transform = mat2d.fromTranslation(mat2d.create(), this.viewBoxBottomLeft);
    mat2d.scale(
      transform,
      transform,
      vec2.divide(vec2.create(), this.viewBoxSize, screenSize)
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

  public get canvasSize(): vec2 {
    return vec2.fromValues(this.canvas.clientWidth, this.canvas.clientHeight);
  }

  public setViewArea(viewArea: BoundingBoxBase) {
    this.viewBoxSize = viewArea.size;
    this.viewBoxBottomLeft = vec2.add(
      vec2.create(),
      viewArea.topLeft,
      vec2.fromValues(0, -viewArea.size.y)
    );
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
