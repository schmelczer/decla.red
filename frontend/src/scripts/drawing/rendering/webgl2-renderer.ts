import { mat2d, vec2, vec3 } from 'gl-matrix';
import { CircleLight } from '../drawables/lights/circle-light';
import { ILight } from '../drawables/lights/i-light';
import { PointLight } from '../drawables/lights/point-light';
import { IPrimitive } from '../drawables/primitives/i-primitive';
import { TunnelShape } from '../drawables/primitives/tunnel-shape';
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
  private cameraPosition = vec2.create();
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
    viewBoxSize?: mat2d;
  } = { ndcToUv: mat2d.fromValues(0.5, 0, 0, 0.5, 0.5, 0.5) };

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
      [CircleLight.descriptor, PointLight.descriptor],
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
    this.calculateMatrices();

    const cursorPosition = this.screenUvToWorldCoordinate(this.cursorPosition);

    this.lightingPass.addDrawable(
      new PointLight(null, cursorPosition, 200, vec3.fromValues(1, 1, 0), 1)
    );

    const viewBoxRadius = vec2.length(
      vec2.scale(vec2.create(), this.viewBoxSize, 0.5)
    );

    this.distancePass.render(
      { ...this.matrices, cursorPosition },
      this.cameraPosition,
      viewBoxRadius
    );

    this.lightingPass.render(
      { ...this.matrices, cursorPosition },
      this.cameraPosition,
      viewBoxRadius,
      this.distanceFieldFrameBuffer.colorTexture
    );

    this.stopwatch?.stop();
  }

  private calculateMatrices() {
    this.matrices.uvToWorld = mat2d.fromTranslation(
      mat2d.create(),
      this.viewBoxBottomLeft
    );
    mat2d.scale(
      this.matrices.uvToWorld,
      this.matrices.uvToWorld,
      this.viewBoxSize
    );

    this.matrices.distanceScreenToWorld = this.getScreenToWorldTransform(
      this.distanceFieldFrameBuffer.getSize()
    );

    this.matrices.worldToDistanceUV = mat2d.scale(
      mat2d.create(),
      this.matrices.distanceScreenToWorld,
      this.distanceFieldFrameBuffer.getSize()
    );
    mat2d.invert(
      this.matrices.worldToDistanceUV,
      this.matrices.worldToDistanceUV
    );
  }

  private getScreenToWorldTransform(screenSize: vec2) {
    const transform = mat2d.fromTranslation(
      mat2d.create(),
      this.viewBoxBottomLeft
    );
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

  public setCameraPosition(position: vec2) {
    this.cameraPosition = position;
    this.viewBoxBottomLeft = vec2.fromValues(
      this.cameraPosition.x - this.viewBoxSize.x / 2,
      this.cameraPosition.y - this.viewBoxSize.y / 2
    );
  }

  public setCursorPosition(position: vec2): void {
    this.cursorPosition = position;
  }

  public setInViewArea(size: number): vec2 {
    const canvasAspectRatio =
      this.canvas.clientWidth / this.canvas.clientHeight;

    return (this.viewBoxSize = vec2.fromValues(
      Math.sqrt(size * canvasAspectRatio),
      Math.sqrt(size / canvasAspectRatio)
    ));
  }

  public drawInfoText(text: string) {
    if (this.overlay.innerText != text) {
      this.overlay.innerText = text;
    }
  }
}
