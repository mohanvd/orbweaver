import assert from "node:assert/strict";
import { test } from "node:test";

import { createFinder } from "../src/core/finder.js";
import { acquireRequire } from "../src/core/webpack.js";
import { MODULE_SPECS, resolveModules } from "../src/discord/modules.js";
import { createFakeDiscord } from "./helpers/fake-discord.js";

test("acquireRequire returns the module cache and leaves the chunk array untouched", () => {
	const discord = createFakeDiscord();
	const require = acquireRequire(discord.scope);

	assert.equal(require, discord.require);
	assert.equal(discord.chunkArray.length, 0);
	assert.equal("$" in discord.scope, false);
});

test("acquireRequire explains itself outside of Discord", () => {
	assert.throws(() => acquireRequire({}), /Run this in the Discord client console/);
});

test("finder uses a hinted export name when it matches", () => {
	const wanted = { ping: () => {} };
	const find = createFinder({ c: { 1: { exports: { other: { ping: () => {} } } }, 2: { exports: { Z: wanted } } } });

	assert.equal(find({ name: "Ping", hints: ["Z"], match: (x) => typeof x.ping === "function" }), wanted);
});

test("finder falls back to scanning when the hinted name is gone", () => {
	const wanted = { ping: () => {} };
	const find = createFinder({ c: { 1: { exports: { renamed: wanted } } } });

	assert.equal(find({ name: "Ping", hints: ["Z"], match: (x) => typeof x.ping === "function" }), wanted);
});

test("finder matches a module whose exports object is the target itself", () => {
	const wanted = { ping: () => {} };
	const find = createFinder({ c: { 1: { exports: wanted } } });

	assert.equal(find({ name: "Ping", match: (x) => typeof x.ping === "function" }), wanted);
});

test("finder survives getters and predicates that throw", () => {
	const discord = createFakeDiscord();
	const find = createFinder(discord.require, { ignore: [discord.scope] });

	const found = find({
		name: "Dispatcher",
		match: (x) => {
			if (x === discord.stores.quests) throw new Error("predicate blew up");
			return typeof x.flushWaitQueue === "function";
		},
	});
	assert.equal(found, discord.stores.dispatcher);
});

test("finder throws for a missing required module and returns null for an optional one", () => {
	const warnings = [];
	const find = createFinder({ c: {} }, { warn: (message) => warnings.push(message) });

	assert.throws(() => find({ name: "Nope", match: () => false }), /Nope was not found/);
	assert.equal(find({ name: "Maybe", optional: true, match: () => false }), null);
	assert.match(warnings[0], /Maybe was not found/);
});

test("every Discord module resolves regardless of its export name", () => {
	const discord = createFakeDiscord({ withGuildChannels: true });
	const find = createFinder(discord.require, { ignore: [discord.scope] });
	const modules = resolveModules(find);

	assert.equal(modules.streamingStore, discord.stores.streaming);
	assert.equal(modules.runningGameStore, discord.stores.runningGames);
	assert.equal(modules.questsStore, discord.stores.quests);
	assert.equal(modules.channelStore, discord.stores.channels);
	assert.equal(modules.dispatcher, discord.stores.dispatcher);
	assert.equal(typeof modules.guildChannelStore.getAllGuilds, "function");
	assert.deepEqual(Object.keys(modules).sort(), Object.keys(MODULE_SPECS).sort());
});

test("the HTTP lookup picks Discord's helper, not the request library under it", () => {
	const discord = createFakeDiscord();
	const find = createFinder(discord.require, { ignore: [discord.scope] });

	assert.equal(find(MODULE_SPECS.api), discord.api);
});

test("guild channels are optional", () => {
	const discord = createFakeDiscord({ withGuildChannels: false });
	const find = createFinder(discord.require, { ignore: [discord.scope] });

	assert.equal(resolveModules(find).guildChannelStore, null);
});
