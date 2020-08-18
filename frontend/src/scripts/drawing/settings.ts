export const settings = {
  qualityScaling: {
    targetDeltaTimeInMilliseconds: 30,
    deltaTimeError: 2,
    deltaTimeResponsiveness: 1 / 16,
    adjusmentRateInMilliseconds: 300,
    scaleTargets: [
      [0.2, 0.1],
      [0.6, 0.1],
      [1, 1],
      /* [1.25, 0.75],
      [1.5, 1],
      [1.75, 1.25],
      [1.75, 1.75],
      [2, 2], */
    ],
    startingTargetIndex: 2,
    scalingOptions: {
      additiveIncrease: 0.2,
      multiplicativeDecrease: 1.15,
    },
  },
  tileMultiplier: 8,
  shaderMacros: {
    edgeSmoothing: 10,
    headRadius: 5,
    torsoRadius: 8,
    footRadius: 2,
  },
  shaderCombinations: {
    lineSteps: [0, 1, 2, 4, 8, 16, 128],
    blobSteps: [0, 1, 2, 8],
    circleLightSteps: [0, 1],
    pointLightSteps: [0, 1, 2, 3],
  },
};
