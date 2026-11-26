# Releasing (maintainers)

Releases are made by hand from the GitHub Actions tab. Nothing is committed
back to the repository: `package.json` stays at `0.0.0`, and git tags hold
the version.

1. Open **Actions → Release → Run workflow** on `main`.
2. Tick **dry-run** first to preview the next version and the release notes.
3. Run it again without dry-run. The workflow then:
   - works out the next version from the PR titles since the last tag
   - builds the `.xpi` with that version
   - creates the `vX.Y.Z` tag and a GitHub release with the notes and the `.xpi`
   - uploads `update.json` to the rolling `release` release, which installed
     copies of the plugin check for updates

If no PR since the last tag is a `fix`, `feat` or breaking change, the
workflow publishes nothing.
