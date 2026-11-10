# boilersync-rs-desktop

Tauri 2 + React desktop app for Boilersync. Remake of the Electron `boilersync-desktop` repo, which is reference only and must never be pushed to from here.

- `src-tauri/` is a thin command layer: template operations call `boilersync-core` directly (path dependency on the sibling `boilersync-rs` checkout); project inspection lives in `src-tauri/src/inspect.rs` and treats the child projects registered in a `.boilersync` as the project's sub-repos; git writes shell out to `git`. Do not add libgit2 and do not spawn the `boilersync` CLI.
- Keep `~/.openbase/boilersync-desktop/repos.json`, the shared `~/.openbase/coder-projects.json` and `~/.openbase/boilersync-desktop/settings.json` formats compatible with the Electron app.
- `src/multi-react/` and `src/boilersync-react/` are vendored from the public `multi-react` and `boilersync-react` repos. Changes to the diff viewer or template form components go there; keep the import aliases (`vite.config.ts`, `tsconfig.json`) so renderer code stays portable.
- Payload types in `src/lib/types.ts` mirror the Rust structs (camelCase); change both sides together.
- Before committing: `pnpm typecheck`, `pnpm build`, and in `src-tauri/`: `cargo fmt`, `cargo clippy --all-targets`, `cargo test`.
- Trunk-based: commit and push to `main`.
