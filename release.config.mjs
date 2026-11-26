// semantic-release configuration. Run via .github/workflows/release.yml.
// The `${...}` placeholders below are semantic-release templates, not JS.
/** @type {import('semantic-release').GlobalConfig} */
export default {
  branches: ["main"],
  tagFormat: "v${version}",
  plugins: [
    ["@semantic-release/commit-analyzer", { preset: "conventionalcommits" }],
    [
      "@semantic-release/release-notes-generator",
      { preset: "conventionalcommits" },
    ],
    [
      "@semantic-release/exec",
      {
        prepareCmd:
          "npm version ${nextRelease.version} --no-git-tag-version --allow-same-version && npm run build",
        successCmd: "bash scripts/publish-update-manifest.sh",
      },
    ],
    [
      "@semantic-release/github",
      {
        assets: [{ path: ".scaffold/build/*.xpi" }],
        failComment: false,
        failTitle: false,
      },
    ],
  ],
};
