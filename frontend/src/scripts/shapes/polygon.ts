import { NoisyPolygonFactory } from 'sdf-2d';
import { settings } from 'shared';

export const Polygon = NoisyPolygonFactory(settings.polygonEdgeCount, 1);
