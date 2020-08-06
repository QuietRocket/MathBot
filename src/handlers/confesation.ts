import { Environment } from '../discord';
import {
    DMChannel,
    TextChannel,
    MessageEmbed
} from 'discord.js';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { resolve } from 'path';

export interface Confesation {
    channel: string;
};

export async function apply(env: Environment) {
    const [config, client, redis, guild] = [env.config, env.client, env.redis, env.guild];

    const rKeys = {
        confesations(id: string) {
            const hash = createHash('md5')
                .update(id)
                .digest()
                .toString('hex');
            return `confesations:${hash}`;
        }
    };

    const dict: {
        animals: string[],
        adjectives: string[]
    } = JSON.parse(
        (await fs.readFile(resolve(__dirname, '../../dictionary.json'))).toString()
    );

    const randomChoose = (items: string[]): string => {
        const index = Math.floor(Math.random() * items.length);
        return items[index];
    };

    const day = 60 * 60 * 24;

    const getPseudo = async (id: string): Promise<string> => {
        const store = await redis.get(rKeys.confesations(id));
        if (store !== null) {
            return store;
        }

        const randomAdjective = randomChoose(dict.adjectives);
        const randomAnimal = randomChoose(dict.animals);

        const newPseudo = `${randomAdjective} ${randomAnimal}`;
        await redis.set(rKeys.confesations(id), newPseudo, 'EX', day);
        return newPseudo;
    };

    const emojis = {
        'send': '📨'
    };

    let channel = guild.channels.resolve(config.confesation.channel) as TextChannel;
    if (channel === null)
        throw Error('Couldn\'t resolve confesation channels.');

    client
        .on('message', async (msg) => {
            if (
                !(msg.channel instanceof DMChannel) ||
                msg.author.bot ||
                !msg.content.startsWith('!')
            )
                return;

            const message = msg.content.substring(1).trim();

            if (!message.length)
                return;

            const pseudo = await getPseudo(msg.author.id);

            const embed = new MessageEmbed().setTitle(pseudo).setDescription(message);

            await channel.send(embed);

            await msg.react(emojis.send);
        });
};