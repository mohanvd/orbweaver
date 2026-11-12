/**
 * PLAY_ACTIVITY.
 *
 * Activity quests are tracked by heartbeats tied to a call. Any channel the user
 * can be in a call with works: a DM if there is one, otherwise a voice channel.
 */

const HEARTBEAT_INTERVAL_MS = 20_000;

function pickChannelId({ channelStore, guildChannelStore }) {
	const dm = channelStore.getSortedPrivateChannels()[0]?.id;
	if (dm) return dm;

	const guilds = Object.values(guildChannelStore?.getAllGuilds() ?? {});
	return guilds.find((guild) => guild?.VOCAL?.length > 0)?.VOCAL[0].channel.id;
}

/** @param {import("./index.js").TaskContext} ctx */
export async function runActivity({ quest, modules, log, sleep }) {
	const { api } = modules;

	const channelId = pickChannelId(modules);
	if (!channelId) {
		throw new Error("No channel available. Open a DM with anyone and run it again.");
	}

	const url = `/quests/${quest.id}/heartbeat`;
	const streamKey = `call:${channelId}:1`;
	log.info(`${quest.name}: running the activity.`);

	while (true) {
		const response = await api.post({ url, body: { stream_key: streamKey, terminal: false } });
		const progress = response.body.progress.PLAY_ACTIVITY.value;
		log.info(`${quest.name}: ${progress}/${quest.target}s`);

		if (progress >= quest.target) {
			await api.post({ url, body: { stream_key: streamKey, terminal: true } });
			return;
		}
		await sleep(HEARTBEAT_INTERVAL_MS);
	}
}
