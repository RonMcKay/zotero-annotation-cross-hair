import { expect } from "chai";
import pkg from "../../package.json" with { type: "json" };

describe("package config", function () {
  it("uses the published add-on id", function () {
    expect(pkg.config.addonID).to.equal(
      "annotation-crosshair@ronmckay.github.io",
    );
  });
});
