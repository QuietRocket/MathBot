import { Environment } from '../discord';
import {
    Message,
    TextChannel,
    DMChannel,
    MessageReaction,
    User,
    MessageEmbed
} from 'discord.js';

export interface Confession {
    moderation: string;
    output: string;
    messageVerify: string;
    messageVerifyTimeout: number;
    messageCancel: string;
    messageSent: string;
};

export async function apply(env: Environment) {
    const [config, client, redis, guild] = [env.config, env.client, env.redis, env.guild];

    const rKeys = {
        counter: 'confession:counter',
        lastDay: 'confession:lastDay'
    };

    const emojis = {
        'check': '✅',
        'cross': '🚫',
        'send': '📨',
        'thumb': '👍',
        'undo': '↩️'
    };

    const formatter = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        timeZone: 'America/Los_Angeles'
    });

    await redis
        .pipeline()
        .setnx(rKeys.counter, 1)
        .setnx(rKeys.lastDay, formatter.format(new Date()))
        .exec();

    const modifyHistory = async (msg: Message, action: ACTION, author?: string) => {
        await msg.edit(`${action} by ${author || 'Unknown'}\n${msg.content}`);
    };

    enum ACTION {
        REJECTED = 'Rejected',
        ACCEPTED = 'Accepted',
        RESET = 'Reset'
    };

    let modChannel = guild.channels.resolve(config.confess.moderation) as TextChannel;
    let outChannel = guild.channels.resolve(config.confess.output) as TextChannel;
    if (modChannel === null || outChannel === null)
        throw Error('Couldn\'t resolve confession channels.');

    client
        .on('message', async (msg) => {
            if (!(msg.channel instanceof DMChannel) || msg.author.bot)
                return;

            const verify = await msg.channel.send(config.confess.messageVerify);
            await verify.react(emojis.thumb);

            const reactionResult = await verify.awaitReactions(
                (reaction: MessageReaction, user: User): boolean =>
                    msg.author.id === user.id && reaction.emoji.name === emojis.thumb
                , {
                    max: 1,
                    time: 1000 * config.confess.messageVerifyTimeout
                });

            if (reactionResult.size === 0) {
                await msg.channel.send(config.confess.messageCancel)
                return;
            }

            const embed = new MessageEmbed().setDescription(msg.content);

            const submission = await modChannel.send(embed);

            await submission.react(emojis.check);
            await submission.react(emojis.cross);

            await msg.channel.send(config.confess.messageSent);
        })
        .on('messageReactionAdd', async (reaction, user) => {
            if (
                reaction.message.channel.id !== config.confess.moderation ||
                user.bot ||
                ![emojis.check, emojis.cross, emojis.undo].includes(reaction.emoji.name)
            )
                return;

            if (reaction.partial) {
                try {
                    await reaction.fetch();
                } catch (e) {
                    console.error(e);
                    return;
                }
            }

            if (reaction.message.partial) {
                try {
                    await reaction.fetch();
                } catch (e) {
                    console.error(e);
                    return;
                }
            }

            const msg = reaction.message;
            const emoji = reaction.emoji.name;

            if (emoji === emojis.cross) {
                await modifyHistory(msg, ACTION.REJECTED, user.username);
                await msg.react(emojis.undo);
            } else if (emoji === emojis.check) {
                if (msg.content.length) {
                    const line = msg.content.split('\n')[0].split(' ')[0];
                    if (
                        line === ACTION.REJECTED || line == ACTION.ACCEPTED
                    )
                        return;
                }

                await modifyHistory(msg, ACTION.ACCEPTED, user.username);
                const day = formatter.format(new Date());
                const lastDay = await redis.get(rKeys.lastDay);
                if (day !== lastDay) {
                    await redis.set(rKeys.counter, 1);
                }
                const counter = await redis.get(rKeys.counter);
                const title = `${day} #${counter}`;
                await redis.set(rKeys.lastDay, day);
                await redis.incr(rKeys.counter);
                if (msg.embeds.length >= 1) {
                    const receivedEmbed = msg.embeds[0];
                    const newEmbed = new MessageEmbed(receivedEmbed).setTitle(title);
                    await outChannel.send(newEmbed)
                } else {
                    const embed = new MessageEmbed().setDescription(msg.content).setTitle(title);
                    await outChannel.send(embed);
                }
                await msg.reactions.removeAll();
                await msg.react(emojis.send);
            } else if (emoji === emojis.undo) {
                await modifyHistory(msg, ACTION.RESET, user.username);
                await msg.reactions.removeAll();
                await msg.react(emojis.check);
                await msg.react(emojis.cross);
            }
        });
};