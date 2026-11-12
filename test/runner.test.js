import assert from "node:assert/strict";
import { test } from "node:test";

import { run } from "../src/runner.js";
import { createFakeDiscord, instantSleep, makeQuest, tick } from "./helpers/fake-discord.js";

const start = (discord, options = {}) =>
	run({ scope: discord.scope, log: discord.log, sleep: instantSleep, random: () => 0.5, ...options });

const posts = (discord) => discord.calls.filter((call) => call.verb === "post");

test("reports when there is nothing to do", async () => {
	const discord = createFakeDiscord({ quests: [makeQuest({ completed: true })] });
	const summary = await start(discord);

	assert.deepEqual(summary, { completed: [], skipped: [], failed: [] });
	assert.match(discord.logs.at(-1).text, /No accepted quests/);
});

test("video quest: reports progress in steps up to the target", async () => {
	const quest = makeQuest({ id: "v", type: "WATCH_VIDEO", target: 20, done: 0 });
	const discord = createFakeDiscord({
		quests: [quest],
		onPost: ({ body }) => ({ body: { completed_at: body.timestamp >= 20 ? "now" : null } }),
	});

	const summary = await start(discord);

	const timestamps = posts(discord).map((call) => call.body.timestamp);
	assert.deepEqual(timestamps, [7.5, 14.5, 20]);
	assert.ok(posts(discord).every((call) => call.url === "/quests/v/video-progress"));
	assert.ok(discord.calls.every((call) => call.client === "discord"));
	assert.deepEqual(summary.completed, ["Quest v"]);
});

test("video quest: sends a final position if the server has not confirmed completion", async () => {
	const discord = createFakeDiscord({
		quests: [makeQuest({ id: "v", type: "WATCH_VIDEO_ON_MOBILE", target: 10, done: 5 })],
		onPost: () => ({ body: { completed_at: null } }),
	});

	await start(discord);

	assert.deepEqual(posts(discord).map((call) => call.body.timestamp), [10, 10]);
});

test("play quest: adds a process for the quest's game, then puts the store back", async () => {
	const quest = makeQuest({ id: "p", type: "PLAY_ON_DESKTOP", target: 900, applicationId: "777" });
	const discord = createFakeDiscord({ quests: [quest] });
	const store = discord.stores.runningGames;

	const running = start(discord);
	await tick();

	assert.equal(discord.calls[0].url, "/applications/public?application_ids=777");
	const [game] = store.getRunningGames();
	assert.equal(game.id, "777");
	assert.equal(game.exeName, "game.exe");
	assert.equal(game.pid, 16000);
	assert.equal(store.getGameForPID(16000), game);
	assert.equal(store.getGameForPID(1), undefined);
	assert.deepEqual(discord.events[0].added, [game]);
	assert.deepEqual(discord.events[0].removed, [{ name: "Real Game", pid: 1 }]);

	discord.heartbeat("PLAY_ON_DESKTOP", 450);
	await tick();
	assert.equal(store.getRunningGames()[0], game, "still running below the target");

	discord.heartbeat("PLAY_ON_DESKTOP", 900);
	const summary = await running;

	assert.deepEqual(summary.completed, ["Quest p"]);
	assert.deepEqual(store.getRunningGames(), [{ name: "Real Game", pid: 1 }]);
	assert.equal(Object.hasOwn(store, "getRunningGames"), false);
	assert.equal(Object.hasOwn(store, "getGameForPID"), false);
	assert.deepEqual(discord.events.at(-1).removed, [game]);
	assert.equal(discord.listeners.get("QUESTS_SEND_HEARTBEAT_SUCCESS").size, 0);
});

test("play quest: the store is restored even when progress tracking fails", async () => {
	const discord = createFakeDiscord({ quests: [makeQuest({ id: "p", type: "PLAY_ON_DESKTOP" })] });

	const running = start(discord);
	await tick();
	discord.stores.dispatcher.dispatch({ type: "QUESTS_SEND_HEARTBEAT_SUCCESS", userStatus: {} });
	const summary = await running;

	assert.deepEqual(summary.failed, ["Quest p"]);
	assert.equal(Object.hasOwn(discord.stores.runningGames, "getRunningGames"), false);
});

test("stream quest: describes the stream as the quest's game until the target is reached", async () => {
	const quest = makeQuest({ id: "s", type: "STREAM_ON_DESKTOP", target: 600, applicationId: "55" });
	const discord = createFakeDiscord({ quests: [quest] });
	const store = discord.stores.streaming;

	const running = start(discord);
	await tick();
	assert.deepEqual(store.getStreamerActiveStreamMetadata(), { id: "55", pid: 16000, sourceName: null });

	discord.heartbeat("STREAM_ON_DESKTOP", 600);
	const summary = await running;

	assert.deepEqual(summary.completed, ["Quest s"]);
	assert.equal(store.getStreamerActiveStreamMetadata(), null);
});

test("legacy quests read progress from streamProgressSeconds", async () => {
	const quest = makeQuest({ id: "s", type: "STREAM_ON_DESKTOP", target: 60, configVersion: 1 });
	const discord = createFakeDiscord({ quests: [quest] });

	const running = start(discord);
	await tick();
	discord.stores.dispatcher.dispatch({
		type: "QUESTS_SEND_HEARTBEAT_SUCCESS",
		userStatus: { streamProgressSeconds: 60 },
	});

	assert.deepEqual((await running).completed, ["Quest s"]);
});

test("activity quest: heartbeats against a DM and closes with a terminal one", async () => {
	let beats = 0;
	const discord = createFakeDiscord({
		quests: [makeQuest({ id: "a", type: "PLAY_ACTIVITY", target: 40 })],
		onPost: () => ({ body: { progress: { PLAY_ACTIVITY: { value: (beats += 1) * 20 } } } }),
	});

	const summary = await start(discord);

	const bodies = posts(discord).map((call) => call.body);
	assert.deepEqual(bodies, [
		{ stream_key: "call:dm-1:1", terminal: false },
		{ stream_key: "call:dm-1:1", terminal: false },
		{ stream_key: "call:dm-1:1", terminal: true },
	]);
	assert.deepEqual(summary.completed, ["Quest a"]);
});

test("activity quest: falls back to a voice channel when there are no DMs", async () => {
	const discord = createFakeDiscord({
		quests: [makeQuest({ id: "a", type: "PLAY_ACTIVITY", target: 10 })],
		privateChannels: [],
		withGuildChannels: true,
		onPost: () => ({ body: { progress: { PLAY_ACTIVITY: { value: 10 } } } }),
	});

	await start(discord);

	assert.equal(posts(discord)[0].body.stream_key, "call:voice-1:1");
});

test("activity quest: fails cleanly when no channel exists", async () => {
	const discord = createFakeDiscord({
		quests: [makeQuest({ id: "a", type: "PLAY_ACTIVITY" })],
		privateChannels: [],
	});

	const summary = await start(discord);

	assert.deepEqual(summary.failed, ["Quest a"]);
	assert.equal(posts(discord).length, 0);
});

test("desktop-only quests are skipped in the browser, the rest still run", async () => {
	const discord = createFakeDiscord({
		desktop: false,
		quests: [
			makeQuest({ id: "p", type: "PLAY_ON_DESKTOP" }),
			makeQuest({ id: "v", type: "WATCH_VIDEO", target: 7 }),
		],
		onPost: () => ({ body: { completed_at: "now" } }),
	});

	const summary = await start(discord);

	assert.deepEqual(summary, { completed: ["Quest v"], skipped: ["Quest p"], failed: [] });
});

test("one failing quest does not stop the next one", async () => {
	const discord = createFakeDiscord({
		quests: [
			makeQuest({ id: "bad", type: "WATCH_VIDEO", target: 7 }),
			makeQuest({ id: "good", type: "WATCH_VIDEO", target: 7 }),
		],
		onPost: ({ url }) => {
			if (url.includes("/bad/")) throw new Error("server said no");
			return { body: { completed_at: "now" } };
		},
	});

	const summary = await start(discord);

	assert.deepEqual(summary, { completed: ["Quest good"], skipped: [], failed: ["Quest bad"] });
});

test("refuses to start twice in the same window", async () => {
	const discord = createFakeDiscord({ quests: [makeQuest({ id: "p", type: "PLAY_ON_DESKTOP" })] });

	const first = start(discord);
	await tick();
	const second = await start(discord);

	assert.deepEqual(second, { completed: [], skipped: [], failed: [] });
	assert.match(discord.logs.at(-1).text, /Already running/);

	discord.heartbeat("PLAY_ON_DESKTOP", 99999);
	await first;
	assert.equal(discord.scope.__orbweaver_running__, false);
});

test("a missing required module surfaces as a clear error", async () => {
	const discord = createFakeDiscord();
	delete discord.require.c[8];

	await assert.rejects(start(discord), /QuestsStore was not found/);
	assert.equal(discord.scope.__orbweaver_running__, false);
});
