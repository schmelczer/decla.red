import { BoundingBoxBase } from '../bounding-boxes/bounding-box-base';
import { StaticPhysical } from './static-physical-object';
// source: https://github.com/ubilabs/kd-tree-javascript/blob/master/kdTree.js

class Node {
  public left?: Node = null;
  public right?: Node = null;
  constructor(public object: StaticPhysical, public parent: Node) {}
}

export class BoundingBoxTree {
  root?: Node;

  constructor(objects: Array<StaticPhysical> = []) {
    this.build(objects);
  }

  public build(objects: Array<StaticPhysical>) {
    this.root = this.buildRecursive(objects, 0, null);
  }

  private buildRecursive(
    objects: Array<StaticPhysical>,
    depth: number,
    parent: Node,
  ): Node {
    if (objects.length === 0) {
      return null;
    }

    if (objects.length === 1) {
      return new Node(objects[0], parent);
    }

    const dimension = depth % 4;

    objects.sort((a, b) => a.boundingBox[dimension] - b.boundingBox[dimension]);

    const median = Math.floor(objects.length / 2);

    const node = new Node(objects[median], parent);
    node.left = this.buildRecursive(objects.slice(0, median), depth + 1, node);
    node.right = this.buildRecursive(objects.slice(median + 1), depth + 1, node);

    return node;
  }

  public insert(object: StaticPhysical) {
    const [insertPosition, depth] = this.findParent(object, this.root, 0, null);

    if (insertPosition === null) {
      this.root = new Node(object, null);
    } else {
      const node = new Node(object, insertPosition);
      const dimension = depth % 4;

      if (object.boundingBox[dimension] < insertPosition.object.boundingBox[dimension]) {
        insertPosition.left = node;
      } else {
        insertPosition.right = node;
      }
    }
  }

  public findIntersecting(boundingBox: BoundingBoxBase): Array<StaticPhysical> {
    const maybeResults = this.findMaybeIntersecting(boundingBox, this.root, 0);
    const results = maybeResults.filter((b) => b.boundingBox.intersects(boundingBox));
    return results;
  }

  private findMaybeIntersecting(
    boundingBox: BoundingBoxBase,
    node: Node,
    depth: number,
  ): Array<StaticPhysical> {
    if (node === null) {
      return [];
    }

    if (depth % 4 == 0 && boundingBox.xMax < node.object.boundingBox.xMin) {
      return this.findMaybeIntersecting(boundingBox, node.left, depth + 1);
    }

    if (depth % 4 == 1 && boundingBox.xMin > node.object.boundingBox.xMax) {
      return this.findMaybeIntersecting(boundingBox, node.right, depth + 1);
    }

    if (depth % 4 == 2 && boundingBox.yMax < node.object.boundingBox.yMin) {
      return this.findMaybeIntersecting(boundingBox, node.left, depth + 1);
    }

    if (depth % 4 == 3 && boundingBox.yMin > node.object.boundingBox.yMax) {
      return this.findMaybeIntersecting(boundingBox, node.right, depth + 1);
    }

    return [
      node.object,
      ...this.findMaybeIntersecting(boundingBox, node.left, depth + 1),
      ...this.findMaybeIntersecting(boundingBox, node.right, depth + 1),
    ];
  }

  private findParent(
    object: StaticPhysical,
    node: Node,
    depth: number,
    parent: Node,
  ): [Node, number] {
    if (node === null) {
      return [parent, depth - 1];
    }

    const dimension = depth % 4;

    if (object.boundingBox[dimension] < node.object.boundingBox[dimension]) {
      return this.findParent(object, node.left, depth + 1, node);
    }

    return this.findParent(object, node.right, depth + 1, node);
  }
}
