/**
 * Reading quests out of the client's QuestsStore.
 */

/** Task types this tool knows how to run, in order of preference. */
export const SUPPORTED_TASKS = [
	"WATCH_VIDEO",
	"PLAY_ON_DESKTOP",
	"STREAM_ON_DESKTOP",
	"PLAY_ACTIVITY",
	"WATCH_VIDEO_ON_MOBILE",
];

const taskConfigOf = (quest) => quest.config.taskConfig ?? quest.config.taskConfigV2;

/**
 * Normalises the parts of a quest the task runners need.
 *
 * @param {any} quest
 * @returns {{ id: string, name: string, type: string, target: number, done: number, applicationId: string | undefined, raw: any } | null}
 */
export function describeQuest(quest) {
	const tasks = taskConfigOf(quest)?.tasks ?? {};
	const type = SUPPORTED_TASKS.find((name) => tasks[name] != null);
	if (!type) return null;

	const task = tasks[type];
	return {
		id: quest.id,
		name: quest.config.messages?.questName ?? quest.id,
		type,
		target: task.target,
		done: quest.userStatus?.progress?.[type]?.value ?? 0,
		applicationId: quest.config.application?.id ?? task.applications?.[0]?.id,
		raw: quest,
	};
}

/**
 * Quests the user has accepted, has not finished, and that have not expired.
 *
 * @param {{ quests: Map<string, any> }} questsStore
 * @param {number} [now]
 */
export function selectPendingQuests(questsStore, now = Date.now()) {
	return [...questsStore.quests.values()]
		.filter((quest) => quest.userStatus?.enrolledAt && !quest.userStatus?.completedAt)
		.filter((quest) => new Date(quest.config.expiresAt).getTime() > now)
		.map(describeQuest)
		.filter(Boolean);
}
