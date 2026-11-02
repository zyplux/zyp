# BASELINE
set shell := ["bash", "-euo", "pipefail", "-c"]

alias i := install
alias k := knip
alias tc := typecheck
alias l := lint
alias t := test
alias c := check
alias u := upgrade
alias ui := upgrade-interactive
alias p := push
alias pr := push-ready

# List available recipes.
default:
    @just --list

# Install both workspaces: pnpm + uv.
install:
    pnpm install
    uv sync --all-packages --all-groups

# Report unused files, deps, and exports: knip (JS workspace) + vulture (Python).
knip:
    pnpm run knip
    pnpm run knip --config knip.prod.json
    uv run vulture

# Type-check both workspaces: tsc for .ts, pyrefly for .py.
typecheck:
    pnpm run typecheck
    uv run pyrefly check

# Lint and format both workspaces with autofix, then verify org invariants with cerberus.
lint:
    pnpm run lint:fix
    pnpm run format
    uv run rumdl check --fix
    uv run rumdl fmt
    uv run ruff check --fix
    uv run ruff format
    uv run cerberus --fix

# Run tests for both workspaces. Optional arg filters by test name; never fails when nothing matches.
test name='':
    pnpm run test {{ if name == '' { '' } else { '-t ' + quote(name) + ' --passWithNoTests' } }}
    uv run pytest {{ if name == '' { '' } else { '-k ' + quote(name) } }}

# Full gate across both workspaces: install, knip, typecheck, lint, test — autofix throughout.
check: install knip typecheck lint test

# Upgrade the pinned toolchain and workspace dependencies through cz.
upgrade *args='':
    pnpm run --silent cz upgrade {{ args }}

# Interactively select JavaScript upgrades.
upgrade-interactive:
    pnpm run --silent cz upgrade --interactive

# Push the current branch and open a draft PR (-r/--ready marks it ready and enables auto-merge).
push *flags:
    pnpm run cz push-branch {{ flags }}

# Push the current branch and open a PR marked ready, enabling auto-merge.
push-ready: (push "--ready")

# Remove gitignored build artifacts and caches.
clean *flags:
    pnpm run cz clean {{ flags }}

# CUSTOM

alias tv := up
alias w := serve
alias bs := build-sandbox
alias cl := clone

# Run the totvibe terminal coding assistant (sandboxed to the working dir by default; pass --no-sandbox to disable)
up *args:
    pnpm start {{ args }}

# Serve the totvibe web UI (Bun.serve + WebSocket agent backend in one process)
serve *args:
    pnpm run serve {{ args }}

# Build the Linux Landlock + namespace sandbox helper (needs Rust)
build-sandbox:
    pnpm run build:sandbox

# Shallow-clone a reference repo into reference_clones/ (optional branch or tag).
clone repo ref="":
    pnpm run cz clone-reference-repo {{ repo }} {{ ref }}
