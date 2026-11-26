import { expect } from "chai";
import { getViewWindows, isAreaToolActive } from "../../src/modules/tool";

const throwingReader = {
  type: "pdf",
  get _internalReader(): never {
    throw new Error("internals changed");
  },
};

describe("tool", function () {
  describe("isAreaToolActive", function () {
    it("reads the public toolType getter", function () {
      expect(isAreaToolActive({ _internalReader: { toolType: "image" } })).to.be
        .true;
    });

    it("falls back to internal state", function () {
      expect(
        isAreaToolActive({
          _internalReader: { _state: { tool: { type: "image" } } },
        }),
      ).to.be.true;
    });

    it("is false for other tools", function () {
      expect(isAreaToolActive({ _internalReader: { toolType: "highlight" } }))
        .to.be.false;
    });

    it("is false for missing or broken readers", function () {
      expect(isAreaToolActive(null)).to.be.false;
      expect(isAreaToolActive({})).to.be.false;
      expect(isAreaToolActive(throwingReader)).to.be.false;
    });
  });

  describe("getViewWindows", function () {
    const w1 = { name: "primary" } as unknown as Window;
    const w2 = { name: "secondary" } as unknown as Window;

    it("returns primary and secondary view windows", function () {
      expect(
        getViewWindows({
          type: "pdf",
          _internalReader: {
            _primaryView: { _iframeWindow: w1 },
            _secondaryView: { _iframeWindow: w2 },
          },
        }),
      ).to.deep.equal([w1, w2]);
    });

    it("skips missing views", function () {
      expect(
        getViewWindows({
          type: "pdf",
          _internalReader: {
            _primaryView: { _iframeWindow: w1 },
            _secondaryView: null,
          },
        }),
      ).to.deep.equal([w1]);
    });

    it("ignores non-PDF readers", function () {
      expect(
        getViewWindows({
          type: "epub",
          _internalReader: { _primaryView: { _iframeWindow: w1 } },
        }),
      ).to.deep.equal([]);
    });

    it("returns nothing for broken readers", function () {
      expect(getViewWindows(throwingReader)).to.deep.equal([]);
      expect(getViewWindows(undefined)).to.deep.equal([]);
    });
  });
});
