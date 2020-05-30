import { DiscordAgent } from './agents/discord';
import { config } from '../config';

(async () => {
    const discord = await DiscordAgent(config);
    discord.start();
})();