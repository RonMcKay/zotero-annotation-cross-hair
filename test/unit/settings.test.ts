import { expect } from "chai";
import {
  DEFAULT_SETTINGS,
  normalizeColor,
  normalizeSettings,
} from "../../src/modules/settings";

describe("settings", function () {
  it("defaults to a subtle grey per page brightness", function () {
    expect(DEFAULT_SETTINGS).to.deep.equal({
      enabled: true,
      colorLight: "#666666",
      colorDark: "#bbbbbb",
    });
  });

  describe("normalizeColor", function () {
    it("accepts and lower-cases hex colours", function () {
      expect(normalizeColor("#ABCDEF", "#000000")).to.equal("#abcdef");
      expect(normalizeColor("#abc", "#000000")).to.equal("#abc");
      expect(normalizeColor("#11223344", "#000000")).to.equal("#11223344");
    });

    it("trims surrounding whitespace", function () {
      expect(normalizeColor("  #00ff00 ", "#000000")).to.equal("#00ff00");
    });

    it("falls back to the given default for anything else", function () {
      for (const bad of [
        "red; display:none",
        "url(x)",
        "#12345",
        "",
        42,
        undefined,
        null,
      ]) {
        expect(normalizeColor(bad, "#123456"), String(bad)).to.equal("#123456");
      }
    });
  });

  describe("normalizeSettings", function () {
    it("keeps valid values", function () {
      expect(
        normalizeSettings({
          enabled: false,
          colorLight: "#000",
          colorDark: "#fff",
        }),
      ).to.deep.equal({
        enabled: false,
        colorLight: "#000",
        colorDark: "#fff",
      });
    });

    it("uses each colour's own default for missing or invalid values", function () {
      expect(normalizeSettings({})).to.deep.equal(DEFAULT_SETTINGS);
      expect(
        normalizeSettings({ colorLight: "nope", colorDark: "nope" }),
      ).to.deep.equal(DEFAULT_SETTINGS);
    });

    it("only disables on an explicit false", function () {
      expect(normalizeSettings({ enabled: "false" }).enabled).to.equal(true);
      expect(normalizeSettings({ enabled: 0 }).enabled).to.equal(true);
    });
  });
});
