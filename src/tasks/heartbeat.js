/**
 * Play and stream quests are tracked by the client itself: it sends a heartbeat to
 * Discord on its own schedule and announces each successful one on the dispatcher.
 * This waits on those announcements until the quest reaches its target.
 */

const HEARTBEAT_EVENT = "QUESTS_SEND_HEARTBEAT_SUCCESS";

const progressOf = (quest, event) =>
	quest.raw.config.configVersion === 1
		? event.userStatus.streamProgressSeconds
		: Math.floor(event.userStatus.progress[quest.type].value);

/**
 * @param {import("./index.js").TaskContext} ctx
 * @returns {Promise<void>} Resolves once reported progress reaches the quest target.
 */
export function waitForHeartbeats({ quest, modules, log }) {
	const { dispatcher } = modules;

	return new Promise((resolve, reject) => {
		const onHeartbeat = (event) => {
			try {
				const progress = progressOf(quest, event);
				log.info(`${quest.name}: ${progress}/${quest.target}s`);
				if (progress >= quest.target) {
					dispatcher.unsubscribe(HEARTBEAT_EVENT, onHeartbeat);
					resolve();
				}
			} catch (error) {
				dispatcher.unsubscribe(HEARTBEAT_EVENT, onHeartbeat);
				reject(error);
			}
		};
		dispatcher.subscribe(HEARTBEAT_EVENT, onHeartbeat);
	});
}
