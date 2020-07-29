export const settings = {
  qualityScaling: {
    targetDeltaTimeInMilliseconds: 30,
    deltaTimeError: 2,
    deltaTimeResponsiveness: 1 / 16,
    adjusmentRateInMilliseconds: 300,
    scaleTargets: [
      [0.2, 0.1],
      [0.6, 0.1],
      [1, 0.3],
      [1.25, 0.75],
      [1.5, 1],
      [1.75, 1.25],
      [1.75, 1.75],
    ],
    startingTargetIndex: 2,
    scalingOptions: {
      additiveIncrease: 0.2,
      multiplicativeDecrease: 1.15,
    },
  },
  tileMultiplier: 5,
  shaderUniforms: {
    distanceScale: 64,
    edgeSmoothing: 10,
  },
};