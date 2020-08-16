// source: https://github.com/ubilabs/kd-tree-javascript/blob/master/kdTree.js

import { ImmutableBoundingBox } from '../../shapes/immutable-bounding-box';

class Node {
  public left?: Node = null;
  public right?: Node = null;

  constructor(public rectangle: ImmutableBoundingBox, public parent: Node) {}
}

export class BoundingBoxTree {
  root?: Node;

  constructor(boxes: Array<ImmutableBoundingBox> = []) {
    this.build(boxes);
  }

  public build(boxes: Array<ImmutableBoundingBox>) {
    this.root = this.buildRecursive(boxes, 0, null);
  }

  private buildRecursive(
    boxes: Array<ImmutableBoundingBox>,
    depth: number,
    parent: Node
  ): Node {
    if (boxes.length === 0) {
      return null;
    }

    if (boxes.length === 1) {
      return new Node(boxes[0], parent);
    }

    const dimension = depth % 4;

    boxes.sort((a, b) => a[dimension] - b[dimension]);

    const median = Math.floor(boxes.length / 2);

    const node = new Node(boxes[median], parent);
    node.left = this.buildRecursive(boxes.slice(0, median), depth + 1, node);
    node.right = this.buildRecursive(boxes.slice(median + 1), depth + 1, node);

    return node;
  }

  public insert(box: ImmutableBoundingBox) {
    const [insertPosition, depth] = this.findParent(box, this.root, 0, null);

    if (insertPosition === null) {
      this.root = new Node(box, null);
    } else {
      const node = new Node(box, insertPosition);
      const dimension = depth % 4;

      if (box[dimension] < insertPosition.rectangle[dimension]) {
        insertPosition.left = node;
      } else {
        insertPosition.right = node;
      }
    }
  }

  public findIntersecting(
    box: ImmutableBoundingBox
  ): Array<ImmutableBoundingBox> {
    const maybeResults = this.findMaybeIntersecting(box, this.root, 0);
    const results = maybeResults.filter((b) => b.intersects(box));
    return results;
  }

  private findMaybeIntersecting(
    box: ImmutableBoundingBox,
    node: Node,
    depth: number
  ): Array<ImmutableBoundingBox> {
    if (node === null) {
      return [];
    }

    if (depth % 4 == 0 && box.xMax < node.rectangle.xMin) {
      return this.findMaybeIntersecting(box, node.left, depth + 1);
    }

    if (depth % 4 == 1 && box.xMin > node.rectangle.xMax) {
      return this.findMaybeIntersecting(box, node.right, depth + 1);
    }

    if (depth % 4 == 2 && box.yMax < node.rectangle.yMin) {
      return this.findMaybeIntersecting(box, node.left, depth + 1);
    }

    if (depth % 4 == 3 && box.yMin > node.rectangle.yMax) {
      return this.findMaybeIntersecting(box, node.right, depth + 1);
    }

    return [
      node.rectangle,
      ...this.findMaybeIntersecting(box, node.left, depth + 1),
      ...this.findMaybeIntersecting(box, node.right, depth + 1),
    ];
  }

  private findParent(
    box: ImmutableBoundingBox,
    node: Node,
    depth: number,
    parent: Node
  ): [Node, number] {
    if (node === null) {
      return [parent, depth - 1];
    }

    const dimension = depth % 4;

    if (box[dimension] < node.rectangle[dimension]) {
      return this.findParent(box, node.left, depth + 1, node);
    }

    return this.findParent(box, node.right, depth + 1, node);
  }
}
