/**
 * WATCH_VIDEO and WATCH_VIDEO_ON_MOBILE.
 *
 * Reports playback position to the video progress endpoint in small steps,
 * at the pace a real viewer would produce.
 */

const STEP_SECONDS = 7;

/** @param {import("./index.js").TaskContext} ctx */
export async function runVideo({ quest, modules, log, sleep, random }) {
	const { api } = modules;
	const url = `/quests/${quest.id}/video-progress`;

	let position = quest.done;
	let completed = false;
	log.info(`${quest.name}: watching the video (${quest.target}s).`);

	while (position < quest.target) {
		await sleep(Math.min(STEP_SECONDS, quest.target - position) * 1000);

		const next = position + STEP_SECONDS;
		const response = await api.post({
			url,
			body: { timestamp: Math.min(quest.target, next + random()) },
		});
		completed = response.body.completed_at != null;
		position = Math.min(quest.target, next);
	}

	if (!completed) {
		await api.post({ url, body: { timestamp: quest.target } });
	}
}
