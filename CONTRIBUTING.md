# Contributing to Trevor

Thanks for taking the time to look. Trevor is a small project and contributions are welcome.

## Filing issues

Open an issue at [github.com/VidhyadharanSS/Trevor/issues](https://github.com/VidhyadharanSS/Trevor/issues). Please include:

- Trevor version (visible in **Settings → About**, or the title bar)
- Operating system and version
- Steps to reproduce
- Expected vs actual behaviour
- Logs from `~/.config/Trevor/logs/` (Linux), `~/Library/Logs/Trevor/` (macOS), or `%APPDATA%\Trevor\logs\` (Windows) if applicable

## Submitting a pull request

1. Fork the repo, create a branch from `main`.
2. Make your change. Keep PRs small and focused on a single topic.
3. Run the checks locally before opening the PR:

   ```bash
   npx tsc -b --pretty false
   npm run build
   cd src-tauri && cargo fmt --check && cargo check
   ```

4. Push and open a PR against `main`.

The CI workflow runs the same checks on every PR. A maintainer will review.

## Code style

- TypeScript: strict mode, no `any` unless you genuinely need it.
- React: function components and hooks, no class components.
- Rust: `cargo fmt` and `cargo clippy` clean.
- Commits: imperative present tense — *"Add toolbar position setting"*, not *"added"* or *"adding"*.

## Areas that always need help

- Translations of the UI strings
- Custom themes
- New export formats
- Plugin system design

## Code of conduct

Be civil. Disagree on the merits, not the person. Maintainers reserve the right to lock or remove anything that turns the issue tracker into a battleground.
