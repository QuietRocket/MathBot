import { Environment } from '../discord';

export interface Roles {
    channel: string;
};

export async function apply(env: Environment) {
    const [config, client, redis] = [env.config, env.client, env.redis];

    client
        .on('message', async (msg) => {
            if (
                msg.channel.id !== config.roles.channel ||
                msg.author.bot
            )
                return;

            const match = msg.content.match(/\/role\s"(.*)"\s(.*)/);
            if (match === null)
                return;
            
            const name = match[1];
            const colorMatch = match[2].match(/\d{1,3}/g);
            if (colorMatch === null || colorMatch.length !== 3) {
                msg.reply('Invalid color.');
                return;
            }
            
            const [r, g, b] = colorMatch;

            msg.reply(`name: "${name}" r: ${r}, g: ${g}, b: ${b}`);
        });
};