# Contributing

Fixes for lookups that Discord broke are the most useful contribution and are always welcome.

## Setup

```sh
npm install
npm test
npm run build
```

Node 20 or newer.

## Before opening a pull request

- `npm run check` passes.
- New behaviour has a test. The fake client in `test/helpers/fake-discord.js` is there so nothing needs a real account.
- `dist/orbweaver.js` is rebuilt and committed. CI rejects a bundle that is out of date.
- Lookups in `src/discord/modules.js` match on what a module can do. Export names belong in `hints` only.

## Out of scope

These will not be merged:

- Anything meant to hide the tool from Discord or evade detection.
- Accepting quests or claiming rewards automatically.
- Anything that reads, stores or sends account tokens.
- Loading code from a remote URL at runtime. The bundle people paste is the code that runs.
