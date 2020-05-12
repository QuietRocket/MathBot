// import ReplAgent from './agents/repl'
// const repl = new ReplAgent();
// repl.start();

import DiscordAgent from './agents/discord';

(async () => {
    const discord = new DiscordAgent('');
    discord.start();
})()