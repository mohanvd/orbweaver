# orbweaver

Completes the Discord Quests you have accepted, from the client's own console. One file, no install, no token.

[![CI](https://github.com/mohanvd/orbweaver/actions/workflows/ci.yml/badge.svg)](https://github.com/mohanvd/orbweaver/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-8b5cf6.svg)](LICENSE)

> [!CAUTION]
> Automating quests breaks Discord's Terms of Service, and Discord acts on it. Since 2026 accounts caught doing this have had quest access suspended, and enforcement can reach the whole account. orbweaver does nothing to hide itself and never will. If you run it, assume Discord can see that you did. Do not run it on an account you cannot afford to lose.

## What it does

orbweaver reads the quests you have already accepted and works through them one at a time.

| Quest type | Where it works | What you do |
| --- | --- | --- |
| Watch a video | Desktop app and browser | Nothing. |
| Play a game | Desktop app only | Nothing. Leave Discord open for the quest's duration. |
| Stream a game | Desktop app only | Stream any window in a voice channel with at least one other person in it. |
| Play an activity | Desktop app and browser | Nothing. |

It does not accept quests for you and it does not claim rewards. Those stay manual.

## Usage

1. Accept a quest in Discord under **Quests**.
2. Open DevTools in the desktop app with `Ctrl+Shift+I` (`Cmd+Option+I` on macOS).
3. Open the **Console** tab.
4. Paste the contents of [`dist/orbweaver.js`](dist/orbweaver.js) and press Enter.
5. Leave the window open. Progress is printed as it goes.

If DevTools does not open, close Discord fully, add this line to its `settings.json` (`%appdata%\discord\settings.json` on Windows), and start it again:

```json
"DANGEROUSLY_ENABLE_DEVTOOLS_ONLY_ENABLE_IF_YOU_KNOW_WHAT_YOURE_DOING": true
```

The bundle is not minified. It is about 400 lines. Read it before you paste it, the same way you should read anything you paste into a console that is logged into your account.

## How it works

The Discord client is a webpack bundle. Its stores, dispatcher and HTTP client all live in a module cache that the page itself can reach. orbweaver gets a handle on that cache, finds the handful of modules it needs, and uses the client's own code paths to report progress.

```
src/
  index.js            entry point
  runner.js           finds pending quests and runs them in order
  quests.js           reads and normalises quests from QuestsStore
  core/
    webpack.js        gets webpack's internal require from the chunk array
    finder.js         locates modules by shape, with known names as a fast path
    patch.js          reversible method replacement
    logger.js         console output
  discord/
    modules.js        the Discord internals in use, each described by its shape
  tasks/
    video.js          WATCH_VIDEO, WATCH_VIDEO_ON_MOBILE
    play.js           PLAY_ON_DESKTOP
    stream.js         STREAM_ON_DESKTOP
    activity.js       PLAY_ACTIVITY
    heartbeat.js      waits on the client's own quest heartbeats
```

### Finding modules by shape

Discord's export names are minified and change between builds. `Z` became `A`, `ZP` became `Ay`, and a script that asks for `exports.Ay` stops working the day that happens.

orbweaver describes each module by what it can do instead:

```js
runningGameStore: {
	name: "RunningGameStore",
	hints: ["Ay", "ZP"],
	match: (x) => fn(x.getRunningGames) && fn(x.getGameForPID),
},
```

The names in `hints` are tried first because that is fast. If none match, every export of every module is checked against `match`. A rename costs a few milliseconds instead of breaking the tool.

Shape matching has one trap, and the tests cover it. Discord's HTTP helper and the request library underneath it expose the same five verbs. The helper takes `{ url, body }`, the library takes a URL string. Pick the wrong one and you get requests to `/[object Object]`. The `api` spec tells them apart by the extra members only the library carries.

### Leaving the client as it was

Play and stream quests work by changing what two stores report while the quest runs. Those changes are made through `patch()`, which records whether the method was an own property or inherited and restores exactly that. The restore runs in a `finally` block, so a failed quest does not leave the client in a modified state.

## Development

Requires Node 20 or newer.

```sh
npm install
npm test         # runs the suite against a fake Discord client
npm run build    # writes dist/orbweaver.js
```

The tests do not touch Discord. `test/helpers/fake-discord.js` builds a small module cache with randomised export names, a decoy request library, exports whose getters throw, and stores that behave like the real ones. Every quest type is run end to end against it.

`dist/orbweaver.js` is committed so it can be copied straight from GitHub. CI fails if it is out of date with `src/`.

### When Discord breaks it

A lookup failure names the module that went missing:

```
[orbweaver] QuestsStore was not found. Discord changed its internals and this lookup needs an update.
```

Open `src/discord/modules.js`, find that spec, and update its `match` to a method the store still has. Add a test for the new shape.

## License

[MIT](LICENSE)

This project is not affiliated with or endorsed by Discord.
