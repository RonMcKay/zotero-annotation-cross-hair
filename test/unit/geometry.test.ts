import { expect } from "chai";
import {
  clampToRect,
  findPageIndex,
  lineBoxes,
  type Rect,
} from "../../src/modules/geometry";

const page0: Rect = { left: 0, top: 0, right: 600, bottom: 800 };
const page1: Rect = { left: 0, top: 810, right: 600, bottom: 1610 };

describe("geometry", function () {
  describe("findPageIndex", function () {
    it("returns the index of the page containing the point", function () {
      expect(findPageIndex([page0, page1], { x: 100, y: 900 })).to.equal(1);
    });

    it("returns -1 in the gap between pages", function () {
      expect(findPageIndex([page0, page1], { x: 100, y: 805 })).to.equal(-1);
    });

    it("treats page edges as inside", function () {
      expect(findPageIndex([page0], { x: 600, y: 800 })).to.equal(0);
    });
  });

  describe("clampToRect", function () {
    it("clamps a point outside the rect onto its border", function () {
      expect(
        clampToRect(
          { left: 0, top: 0, right: 100, bottom: 200 },
          { x: 150, y: -10 },
        ),
      ).to.deep.equal({ x: 100, y: 0 });
    });
  });

  describe("lineBoxes", function () {
    const page: Rect = { left: 10, top: 20, right: 110, bottom: 220 };

    it("centres 1px lines on the pointer and spans the page", function () {
      expect(lineBoxes(page, { x: 50, y: 70 })).to.deep.equal({
        h: { left: 10, top: 69.5, width: 100 },
        v: { left: 49.5, top: 20, height: 200 },
      });
    });

    it("clamps to the page when the pointer is outside it", function () {
      const boxes = lineBoxes(page, { x: 500, y: 70 });
      expect(boxes.v.left).to.equal(109.5);
      expect(boxes.h.top).to.equal(69.5);
    });
  });
});
