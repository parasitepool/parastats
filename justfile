
default:
  just --list

dev:
  pnpm dev

install:
  pnpm install

build: install
  pnpm build

lint:
  pnpm lint

audit:
  pnpm audit --prod
  pnpm audit --dev --audit-level=high

ci: install lint audit

# Seed the local badge cache with demo users at various counts to preview the badge UI.
# Prints the profile URLs to visit. Undo with: just demo_badges_clear
demo_badges:
  pnpm tsx scripts/demo-badges.ts

demo_badges_clear:
  pnpm tsx scripts/demo-badges.ts --clear

prepare-release revision='master':
  #!/usr/bin/env bash
  set -euxo pipefail
  git checkout {{ revision }}
  git pull origin {{ revision }}
  echo >> CHANGELOG.md
  git log --pretty='format:- %s' >> CHANGELOG.md
  $EDITOR CHANGELOG.md
  $EDITOR package.json
  version=$(grep -m1 '"version":' package.json | cut -d'"' -f4)
  pnpm update
  just ci 
  git checkout -b release-$version
  git add -u
  git commit -m "Release $version"
  gh pr create --web
