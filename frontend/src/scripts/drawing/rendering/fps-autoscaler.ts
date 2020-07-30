import { Autoscaler } from '../../helper/autoscaler';
import { settings } from '../settings';
import { exponentialDecay } from '../../helper/exponential-decay';
import { InfoText } from '../../objects/types/info-text';
import { FrameBuffer } from '../graphics-library/frame-buffer/frame-buffer';
import { toPercent } from '../../helper/to-percent';

export class FpsAutoscaler extends Autoscaler {
  private timeSinceLastAdjusment = 0;
  private exponentialDecayedDeltaTime = 0.0;

  constructor(private frameBuffers: Array<FrameBuffer>) {
    super(
      frameBuffers.map((f) => (v) => (f.renderScale = v)),
      settings.qualityScaling.scaleTargets,
      settings.qualityScaling.startingTargetIndex,
      settings.qualityScaling.scalingOptions
    );
  }

  public autoscale(lastDeltaTime: DOMHighResTimeStamp) {
    this.timeSinceLastAdjusment += lastDeltaTime;
    if (
      this.timeSinceLastAdjusment >=
      settings.qualityScaling.adjusmentRateInMilliseconds
    ) {
      this.timeSinceLastAdjusment = 0;
      this.exponentialDecayedDeltaTime = exponentialDecay(
        this.exponentialDecayedDeltaTime,
        lastDeltaTime,
        settings.qualityScaling.deltaTimeResponsiveness
      );

      if (
        this.exponentialDecayedDeltaTime <=
        settings.qualityScaling.targetDeltaTimeInMilliseconds -
          settings.qualityScaling.deltaTimeError
      ) {
        this.increase();
      } else if (
        this.exponentialDecayedDeltaTime >
        settings.qualityScaling.targetDeltaTimeInMilliseconds +
          settings.qualityScaling.deltaTimeError
      ) {
        this.decrease();
      }
    }

    InfoText.modifyRecord(
      'quality',
      this.frameBuffers.map((f) => toPercent(f.renderScale)).join(', ')
    );
  }
}
