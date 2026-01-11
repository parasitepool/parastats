install:
  pnpm install

build: install
  pnpm build

lint:
  pnpm lint

audit:
  pnpm audit

ci: install lint audit

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
