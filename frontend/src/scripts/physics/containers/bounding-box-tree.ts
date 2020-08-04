import { ImmutableBoundingBox } from './immutable-bounding-box';

// source: https://github.com/ubilabs/kd-tree-javascript/blob/master/kdTree.js

class Node {
  public left?: Node = null;
  public right?: Node = null;

  constructor(public rectangle: ImmutableBoundingBox, public parent: Node) {}
}

export class BoundingBoxTree {
  root?: Node;

  constructor(boxes?: Array<ImmutableBoundingBox>) {
    if (boxes) {
      this.build(boxes);
    }
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

  public print() {
    this.printRecursive(this.root, 0);
  }

  private printRecursive(node: Node, tabCount: number) {
    if (node === null) {
      return;
    }

    console.log(' '.repeat(tabCount) + '- ' + node.rectangle.value);
    this.printRecursive(node.left, tabCount + 2);
    this.printRecursive(node.right, tabCount + 2);
  }

  public findIntersecting(
    box: ImmutableBoundingBox
  ): Array<ImmutableBoundingBox> {
    const maybeResults = this.findMaybeIntersecting(box, this.root, 0);
    const results = maybeResults.filter(box.intersects.bind(box));
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

    const comparisons: Array<(
      a: ImmutableBoundingBox,
      b: ImmutableBoundingBox
    ) => boolean> = [
      (a, b) => a.xMin < b.xMax,
      (a, b) => a.xMax > b.xMin,
      (a, b) => a.yMin < b.yMax,
      (a, b) => a.xMax > b.xMin,
    ];

    if (comparisons[depth % 4](node.rectangle, box)) {
      return [
        node.rectangle,
        ...this.findMaybeIntersecting(box, node.left, depth + 1),
        ...this.findMaybeIntersecting(box, node.right, depth + 1),
      ];
    }

    return this.findMaybeIntersecting(box, node.left, depth + 1);
  }

  private findParent(
    box: ImmutableBoundingBox,
    node: Node,
    depth: number,
    parent: Node
  ): [Node, number] {
    if (node === null) {
      return [parent, depth];
    }

    const dimension = depth % 4;

    if (box[dimension] < node.rectangle[dimension]) {
      return this.findParent(box, node.left, depth + 1, node);
    }

    return this.findParent(box, node.right, depth + 1, node);
  }
}
