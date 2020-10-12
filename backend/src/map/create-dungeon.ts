import { vec2, vec3 } from 'gl-matrix';
import { last, Random, settings } from 'shared';
import { LampPhysical } from '../objects/lamp-physical';
import { StonePhysical } from '../objects/stone-physical';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { Physical } from '../physics/physical';

export const createDungeon = (objectContainer: PhysicalContainer) => {
  const width = 100000;
  const height = 10000;
  const objects: Array<Physical> = [];
  const lights: Array<Physical> = [];

  let previousEnd = vec2.fromValues(-width / 2, 0);
  while (previousEnd.x < width / 2) {
    const { stone, end } = createFloorElement(previousEnd);
    objects.push(stone);
    previousEnd = end;
  }
  const calculateDistanceField = (target: vec2): number =>
    objects.reduce((min, i) => (min = Math.min(min, i.distance(target))), 1000);

  for (let i = 0; i < 400; i++) {
    let position: vec2;

    do {
      position = vec2.fromValues(
        Random.getRandomInRange(-width / 2, width / 2),
        Random.getRandomInRange(0, height),
      );
    } while (
      calculateDistanceField(position) < 600 ||
      calculateDistanceField(position) > 2000
    );

    objects.push(
      createBlob(
        position,
        Random.getRandomInRange(200, 2000),
        Random.getRandomInRange(100, 500),
        Random.getRandomInRange(10, 40),
      ),
    );
  }

  let tryCount = 0;
  lightGeneration: for (let i = 0; i < 300; i++) {
    console.log(i);
    let position: vec2;
    do {
      position = vec2.fromValues(
        Random.getRandomInRange(-width / 2, width / 2),
        Random.getRandomInRange(-1000, height),
      );

      if (tryCount++ > 1e4) {
        break lightGeneration;
      }
    } while (
      calculateDistanceField(position) < 200 ||
      lights.find((l) => l.distance(position) < 1200)
    );
    lights.push(
      new LampPhysical(
        position,
        vec3.normalize(
          vec3.create(),
          vec3.fromValues(
            Random.getRandomInRange(0.5, 1),
            0,
            Random.getRandomInRange(0.5, 1),
          ),
        ),
        Random.getRandomInRange(0.75, 1.5),
      ),
    );
  }

  [...objects, ...lights].forEach((o) => objectContainer.addObject(o));
};

const createBlob = (
  center: vec2,
  width: number,
  height: number,
  randomness: number,
): StonePhysical => {
  const vertices = [];

  for (let i = 0; i < settings.polygonEdgeCount; i++) {
    vertices.push(
      vec2.fromValues(
        center.x +
          (width / 2) * Math.cos((i / settings.polygonEdgeCount) * -Math.PI * 2) +
          Random.getRandomInRange(-randomness, randomness),
        center.y +
          (height / 2) * Math.sin((i / settings.polygonEdgeCount) * -Math.PI * 2) +
          Random.getRandomInRange(-randomness, randomness),
      ),
    );
  }
  return new StonePhysical(vertices);
};

const createFloorElement = (
  start: vec2,
): {
  stone: StonePhysical;
  end: vec2;
} => {
  const vertices: Array<vec2> = [vec2.fromValues(start.x, -10000), start];

  let previousX = start.x;
  let previousY = start.y;
  for (let i = 0; i < settings.polygonEdgeCount - 3; i++) {
    previousX += Random.getRandomInRange(200, 800);
    previousY += Random.getRandomInRange(-100, 100);
    vertices.push(vec2.fromValues(previousX, previousY));
  }

  const end = last(vertices)!;
  vertices.push(vec2.fromValues(end.x, -10000));
  return {
    stone: new StonePhysical(vertices),
    end,
  };
};
