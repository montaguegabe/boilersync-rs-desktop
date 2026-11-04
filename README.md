# boilersync-rs-desktop

BoilerSync Desktop scaffolds projects from the templates in your local BoilerSync cache and keeps an eye on the projects you made: it lists them with their aggregate git status (a project and the child projects registered in its `.boilersync` count as one), shows a combined working-tree diff across them, lets you stage lines or files and commit per repo (optionally with AI-generated messages), pushes them all at once, and browses a cross-repo commit timeline.

This is the Tauri 2 + React implementation that replaces the Electron `boilersync-desktop` app. The Rust side links `boilersync-core` from the sibling `boilersync-rs` checkout directly; nothing is spawned for template operations.

## Layout

| Path | Purpose |
| --- | --- |
| `src-tauri/` | Rust host: template commands over `boilersync-core`, project inspection (`inspect.rs`), git writes (stage, commit, push, discard), native menus and context menus, `boilersync://` deep links, OpenAI commit messages |
| `src/` | React renderer (Vite, Tailwind 3, react-router): template generator, project list, diff and commit screens, settings |
| `src/multi-react/` | The shared diff viewer library, vendored from the `multi-react` repo |
| `src/boilersync-react/` | The shared template form components, vendored from the `boilersync-react` repo |
| `src/lib/bridge.ts` | The renderer's typed view of every Tauri command and host event |

## Development

Prerequisites: Rust (stable), Node 20+, pnpm, and the Tauri 2 system dependencies for your platform. The `boilersync-rs` repo must be checked out as a sibling directory (the multi workspace does this for you) because `src-tauri/Cargo.toml` depends on `../../boilersync-rs/crates/boilersync-core`.

```bash
pnpm install
pnpm tauri dev            # run the app with hot reload
pnpm typecheck            # tsc
cd src-tauri && cargo test && cargo clippy --all-targets
pnpm tauri build          # release bundles under src-tauri/target/release/bundle
```

On macOS, `scripts/install-local-app.sh` builds the app and copies it to `/Applications`, replacing a running copy.

## State and integration

- Project list: `~/.openbase/coder-projects.json` when it exists (shared with Openbase Coder), otherwise `~/.openbase/boilersync-desktop/repos.json` (`[{ "path": "..." }]`). Settings: `~/.openbase/boilersync-desktop/settings.json` (`{ "openAIApiKey": "...", "projectOpenProgram": "cursor" | "vscode" }`). Both are shared with the Electron app.
- Templates come from `${BOILERSYNC_TEMPLATE_DIR:-~/.boilersync/templates}`, the same cache the `boilersync` CLI uses; generating a project runs the same `init` as `boilersync init --non-interactive`, then opens the project in Cursor or VS Code.
- `boilersync://open?path=<percent-encoded path>` opens a project; a file opens its repository with that file first.
- "Open in Cursor" and "Open in GitHub Desktop" launch the `cursor` and `github` CLIs; "Sync All" can create a private GitHub repo through `gh` when a repo has no remote.
