import { expect } from "chai";
import { isDarkBackground, parseCssColor } from "../../src/modules/background";

describe("background", function () {
  describe("parseCssColor", function () {
    it("parses hex colours", function () {
      expect(parseCssColor("#2E3440")).to.deep.equal({ r: 46, g: 52, b: 64 });
      expect(parseCssColor("#fff")).to.deep.equal({ r: 255, g: 255, b: 255 });
      expect(parseCssColor("#00000080")).to.deep.equal({ r: 0, g: 0, b: 0 });
    });

    it("parses rgb() and rgba() with surrounding whitespace", function () {
      expect(parseCssColor(" rgb(18, 18, 18) ")).to.deep.equal({
        r: 18,
        g: 18,
        b: 18,
      });
      expect(parseCssColor("rgba(244,236,216,0.5)")).to.deep.equal({
        r: 244,
        g: 236,
        b: 216,
      });
    });

    it("returns null for anything else", function () {
      for (const bad of ["", "white", "var(--x)", "#12", "rgb(1,2)", "#ggg"]) {
        expect(parseCssColor(bad), bad).to.be.null;
      }
    });
  });

  describe("isDarkBackground", function () {
    it("treats Zotero's dark themes as dark", function () {
      expect(isDarkBackground("#2E3440")).to.equal(true); // Dark
      expect(isDarkBackground("#000000")).to.equal(true); // Black
      expect(isDarkBackground("#121212")).to.equal(true);
    });

    it("treats white and Zotero's light themes as light", function () {
      expect(isDarkBackground("#FFFFFF")).to.equal(false);
      expect(isDarkBackground("#ECEFF4")).to.equal(false); // Snow
      expect(isDarkBackground("#F4ECD8")).to.equal(false); // Sepia
    });

    it("splits at the black/white contrast crossover", function () {
      expect(isDarkBackground("#757575")).to.equal(true); // L ≈ 0.178
      expect(isDarkBackground("#767676")).to.equal(false); // L ≈ 0.181
    });

    it("returns null when the colour cannot be read", function () {
      expect(isDarkBackground("")).to.be.null;
      expect(isDarkBackground("transparent")).to.be.null;
    });
  });
});
