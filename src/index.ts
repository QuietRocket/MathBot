import DiscordAgent, { DiscordTargets } from './agents/discord';
import { config } from './config';

export interface Configuration {
    token: string;
    targets: DiscordTargets;
    pruneInterval: number;
}

(() => {
    const discord = new DiscordAgent(config.token, config.targets, config.pruneInterval);
    discord.start();
})();