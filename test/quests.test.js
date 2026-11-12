import assert from "node:assert/strict";
import { test } from "node:test";

import { patch } from "../src/core/patch.js";
import { describeQuest, selectPendingQuests } from "../src/quests.js";
import { makeQuest } from "./helpers/fake-discord.js";

const storeOf = (...quests) => ({ quests: new Map(quests.map((quest) => [quest.id, quest])) });

test("selects only accepted, unfinished, unexpired quests", () => {
	const pending = selectPendingQuests(
		storeOf(
			makeQuest({ id: "ok" }),
			makeQuest({ id: "not-enrolled", enrolled: false }),
			makeQuest({ id: "done", completed: true }),
			makeQuest({ id: "expired", expiresIn: -1000 }),
		),
	);

	assert.deepEqual(pending.map((quest) => quest.id), ["ok"]);
});

test("ignores quests with no task this tool can run", () => {
	const quest = makeQuest({ id: "odd", type: "SOMETHING_NEW" });

	assert.equal(describeQuest(quest), null);
	assert.deepEqual(selectPendingQuests(storeOf(quest)), []);
});

test("describes a quest from the v2 task config", () => {
	const quest = describeQuest(
		makeQuest({ id: "7", name: "Play It", type: "PLAY_ON_DESKTOP", target: 900, done: 120, applicationId: "99" }),
	);

	assert.deepEqual(
		{ id: quest.id, name: quest.name, type: quest.type, target: quest.target, done: quest.done, applicationId: quest.applicationId },
		{ id: "7", name: "Play It", type: "PLAY_ON_DESKTOP", target: 900, done: 120, applicationId: "99" },
	);
});

test("reads the legacy task config and application id when present", () => {
	const raw = makeQuest({ type: "STREAM_ON_DESKTOP" });
	raw.config.taskConfig = { tasks: { STREAM_ON_DESKTOP: { target: 600 } } };
	raw.config.application = { id: "legacy-app" };

	const quest = describeQuest(raw);
	assert.equal(quest.target, 600);
	assert.equal(quest.applicationId, "legacy-app");
});

test("patch restores an inherited method without leaving an own property behind", () => {
	class Store {
		value() {
			return "real";
		}
	}
	const store = new Store();

	const restore = patch(store, "value", () => "fake");
	assert.equal(store.value(), "fake");

	restore();
	restore();
	assert.equal(store.value(), "real");
	assert.equal(Object.hasOwn(store, "value"), false);
});

test("patch restores an own method to the same function", () => {
	const original = () => "real";
	const store = { value: original };

	const restore = patch(store, "value", () => "fake");
	restore();
	assert.equal(store.value, original);
});
