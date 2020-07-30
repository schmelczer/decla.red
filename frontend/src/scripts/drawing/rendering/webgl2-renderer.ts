import { mat2d, vec2 } from 'gl-matrix';
import caveFragmentShader from '../shaders/cave-distance-fs.glsl';
import lightsFragmentShader from '../shaders/lights-shading-fs.glsl';
import caveVertexShader from '../shaders/passthrough-distance-vs.glsl';
import lightsVertexShader from '../shaders/passthrough-shading-vs.glsl';
// import lightsShader from '../shaders/rainbow-shading-fs.glsl';
import { DefaultFrameBuffer } from '../graphics-library/frame-buffer/default-frame-buffer';
import { IntermediateFrameBuffer } from '../graphics-library/frame-buffer/intermediate-frame-buffer';
import { WebGlStopwatch } from '../graphics-library/helper/stopwatch';
import { IProgram } from '../graphics-library/program/i-program';
import { UniformArrayAutoScalingProgram } from '../graphics-library/program/uniform-array-autoscaling-program';
import { IRenderer } from '../i-renderer';
import { Circle } from '../drawables/primitives/circle';
import { IPrimitive } from '../drawables/primitives/i-primitive';
import { Rectangle } from '../drawables/primitives/rectangle';
import { ILight } from '../drawables/lights/i-light';
import { settings } from '../settings';
import { FpsAutoscaler } from './fps-autoscaler';
import { getWebGl2Context } from '../graphics-library/helper/get-webgl2-context';
import { RenderingPass } from './rendering-pass';
import { TunnelShape } from '../drawables/primitives/tunnel-shape';
import { CircleLight } from '../drawables/lights/circle-light';

export class WebGl2Renderer implements IRenderer {
  private gl: WebGL2RenderingContext;
  private stopwatch?: WebGlStopwatch;

  private viewBox: Rectangle = new Rectangle();
  private viewCircle: Circle = new Circle();

  private cursorPosition = vec2.create();

  private distanceFieldFrameBuffer: IntermediateFrameBuffer;
  private lightingFrameBuffer: DefaultFrameBuffer;
  private distancePass: RenderingPass;
  private lightingPass: RenderingPass;

  private autoscaler: FpsAutoscaler;

  constructor(private canvas: HTMLCanvasElement, private overlay: HTMLElement) {
    this.gl = getWebGl2Context(canvas);

    this.distanceFieldFrameBuffer = new IntermediateFrameBuffer(this.gl);
    this.lightingFrameBuffer = new DefaultFrameBuffer(this.gl);

    this.distancePass = new RenderingPass(
      this.gl,
      [caveVertexShader, caveFragmentShader],
      [TunnelShape.descriptor],
      this.distanceFieldFrameBuffer
    );

    this.lightingPass = new RenderingPass(
      this.gl,
      [lightsVertexShader, lightsFragmentShader],
      [CircleLight.descriptor],
      this.lightingFrameBuffer
    );

    this.autoscaler = new FpsAutoscaler([
      this.lightingFrameBuffer,
      this.distanceFieldFrameBuffer,
    ]);

    try {
      this.stopwatch = new WebGlStopwatch(this.gl);
    } catch {}
  }

  public drawPrimitive(primitive: IPrimitive) {
    this.distancePass.addDrawable(primitive);
  }

  public drawLight(light: ILight) {
    this.lightingPass.addDrawable(light);
  }

  public startFrame(deltaTime: DOMHighResTimeStamp): void {
    this.autoscaler.autoscale(deltaTime);

    this.stopwatch?.start();
    this.distanceFieldFrameBuffer.setSize();
    this.lightingFrameBuffer.setSize();
  }

  public finishFrame() {
    const uniforms = this.calculateOwnUniforms();
    this.distancePass.render(uniforms, this.viewCircle);
    this.lightingPass.render(
      uniforms,
      this.viewCircle,
      this.distanceFieldFrameBuffer.colorTexture
    );
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
