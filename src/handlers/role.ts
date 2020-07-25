import { Environment } from '../discord';
import { Guild } from 'discord.js';

export interface Roles {
    channel: string;
};

export async function apply(env: Environment) {
    const [config, client, redis] = [env.config, env.client, env.redis];

    let guild: Guild

    client
        .on('ready', () => {
            guild = client.guilds.resolve(env.config.guild) as Guild;

            if (guild === null)
                throw Error('Couldn\'t resolve guild.');
        })
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
            
            const colors = colorMatch.map(a => parseInt(a)).filter(a => !isNaN(a));
            if (colors.length !== 3) {
                msg.reply('Invalid color.');
                return;
            }
            
            const [r, g, b] = colors;
        });
};