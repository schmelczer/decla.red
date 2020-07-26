import { InfoText } from '../../../objects/types/info-text';
import { FragmentShaderOnlyProgram } from './fragment-shader-only-program';
import { IProgram } from './i-program';

export class UniformArrayAutoScalingProgram implements IProgram {
  private programs: Array<{
    program: FragmentShaderOnlyProgram;
    value: number;
  }> = [];
  private current: FragmentShaderOnlyProgram;

  constructor(
    private gl: WebGL2RenderingContext,
    private vertexShaderSource: string,
    private fragmentShaderSource: string,
    private substitutions: { [name: string]: any },
    private options: {
      getValueFromUniforms: (values: { [name: string]: any }) => number;
      uniformArraySizeName: string;
      startingValue: number;
      steps: number;
      maximumValue: number;
    }
  ) {
    for (
      let i = options.startingValue;
      i < options.maximumValue;
      i += options.steps
    ) {
      this.createProgram(i);
    }
  }

  bindAndSetUniforms(values: { [name: string]: any }): void {
    let value = this.options.getValueFromUniforms(values);
    value = Math.min(this.options.maximumValue, value);

    InfoText.modifyRecord(this.options.uniformArraySizeName, value.toString());

    const closest = this.programs.find(
      (p) => value < p.value && value + this.options.steps >= p.value
    );
    if (closest) {
      this.current = closest.program;
    } else {
      this.current = this.createProgram(value + this.options.steps);
    }

    this.current.bindAndSetUniforms(values);
  }

  draw(): void {
    this.current.draw();
  }

  delete(): void {
    this.programs.forEach((p) => p.program.delete());
  }

  private createProgram(arraySize: number): FragmentShaderOnlyProgram {
    const program = new FragmentShaderOnlyProgram(
      this.gl,
      this.vertexShaderSource,
      this.fragmentShaderSource,
      {
        [this.options.uniformArraySizeName]: Math.floor(arraySize).toString(),
        ...this.substitutions,
      }
    );

    this.programs.push({
      program,
      value: arraySize,
    });

    return program;
  }
}
