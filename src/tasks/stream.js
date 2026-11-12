/**
 * STREAM_ON_DESKTOP.
 *
 * The user streams any window in a voice channel. While the quest runs, the
 * streaming store describes that stream as the quest's application.
 */

import { patch } from "../core/patch.js";
import { waitForHeartbeats } from "./heartbeat.js";

/** @param {import("./index.js").TaskContext} ctx */
export async function runStream(ctx) {
	const { quest, modules, log, random } = ctx;
	const pid = Math.floor(random() * 30000) + 1000;

	const restore = patch(modules.streamingStore, "getStreamerActiveStreamMetadata", () => ({
		id: quest.applicationId,
		pid,
		sourceName: null,
	}));

	const minutes = Math.ceil((quest.target - quest.done) / 60);
	log.info(`${quest.name}: stream any window in a voice channel. About ${minutes} min left.`);
	log.info("At least one other person has to be in the channel for it to count.");

	try {
		await waitForHeartbeats(ctx);
	} finally {
		restore();
	}
}
