import { PolygonFactory } from 'sdf-2d';
import { settings } from 'shared';

export const Polygon = PolygonFactory(settings.polygonEdgeCount);
