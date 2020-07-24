import {
    Client,
    Message,
    TextChannel,
    DMChannel,
    MessageReaction,
    User,
    MessageEmbed
} from 'discord.js';

import Redis from 'ioredis';

export interface DiscordConfig {
    token: string;
    confess: Confess;
    infinity: Infinity;
};

export interface Confess {
    moderation: string;
    output: string;
    messageVerify: string;
    messageVerifyTimeout: number;
    messageCancel: string;
    messageSent: string;
};

export interface Infinity {
    channel: string;
    manager: string;
};

const rKeys = {
    infinity: {
        current: 'infinity:current',
        goal: 'infinity:goal',
        factor: 'infinity:factor',
        lastId: 'infinity:lastId'
    }
};

export const DiscordAgent = async (config: DiscordConfig) => {
    const client = new Client({ partials: ['MESSAGE', 'REACTION'] });
    const redis = new Redis(process.env.REDIS_URL);

    await redis.pipeline()
        .setnx(rKeys.infinity.current, 0)
        .setnx(rKeys.infinity.goal, 1)
        .setnx(rKeys.infinity.factor, 2)
    .exec();

    // Confession stuff

    let modChannel: TextChannel;
    let outChannel: TextChannel;
    const emojis = {
        'check': '✅',
        'cross': '🚫',
        'send': '📨',
        'thumb': '👍',
        'undo': '↩️',
        'x': '❌'
    };

    const formatter = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        timeZone: 'America/Los_Angeles'
    });

    let confessionCounter = 1;
    let lastDay = formatter.format(new Date());

    const resetCounter = () => {
        confessionCounter = 1;
    };

    const modifyHistory = async (msg: Message, action: ACTION, author?: string) => {
        await msg.edit(`${action} by ${author || 'Unknown'}\n${msg.content}`);
    };

    enum ACTION {
        REJECTED = 'Rejected',
        ACCEPTED = 'Accepted',
        RESET = 'Reset'
    };

    // Infinity stuff

    const matchInteger = (str: string): number | null => {
        const match = str.match(/((?:\d|,)+)/);
        if (match === null)
            return null;

        const processed = match[1].replace(/,/g, '');
        const parsed = parseInt(processed);

        if (isNaN(parsed))
            return null;
        
        return parsed;
    };

    return {
        start() {

            // General events
            client
                .on('disconnect', async () => {
                    client.destroy();
                });

            // Confession events
            client
                .on('ready', () => {
                    modChannel = client.channels.resolve(config.confess.moderation) as TextChannel;
                    outChannel = client.channels.resolve(config.confess.output) as TextChannel;

                    if (modChannel === null || outChannel === null)
                        throw Error('Couldn\'t resolve confession channels.');
                })
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
                        if (msg.content.length && msg.content.split('\n')[0].split(' ')[0] === ACTION.REJECTED)
                            return;

                        await modifyHistory(msg, ACTION.ACCEPTED, user.username);
                        const day = formatter.format(new Date());
                        if (day !== lastDay) {
                            resetCounter();
                        }
                        const title = `${day} #${confessionCounter}`;
                        lastDay = day;
                        confessionCounter++;
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
            
            client
                .on('message', async (msg) => {
                    if (
                        msg.channel.id !== config.infinity.channel ||
                        msg.author.bot
                    )
                        return;
                    
                    const [
                        [_currentError, currentRaw],
                        [_goalError, goalRaw],
                        [_factorError, factorRaw]
                    ] = await redis.pipeline()
                        .get(rKeys.infinity.current)
                        .get(rKeys.infinity.goal)
                        .get(rKeys.infinity.factor)
                    .exec();
                    
                    const current = parseInt(currentRaw);
                    const goal = parseInt(goalRaw);
                    const factor = parseInt(factorRaw);
                    const nextGoal = goal * factor;
                    const correct = current + 1;
                    
                    if (msg.content.startsWith('/stats')) {
                        msg.reply(`The next number is ${correct}. The goal is ${goal}. The next goal is ${nextGoal} (factor: x${factor}).`)
                        return;
                    }
                    
                    const match = msg.content.match(/\/set(current|goal|factor)\s(.*)/);
                    if (match === null) {
                        const num = matchInteger(msg.content);
                        if (num === null)
                            return;
                            
                        const authorId = msg.author.id;
                        const lastId = await redis.get(rKeys.infinity.lastId);
                        if (authorId === lastId) {
                            await msg.reply('You already went your turn!');
                            return;
                        }

                        if (num === correct) {
                            await redis.incr(rKeys.infinity.current);
                        } else {
                            await msg.react(emojis.x);
                        }

                        if (current === goal) {
                            await msg.channel.send(`Woohoo! The goal of ${goal} was met! The next goal is ${nextGoal} (factor: x${factor}).`);
                            await redis.set(rKeys.infinity.goal, nextGoal);
                        }

                        await redis.set(rKeys.infinity.lastId, authorId);
                    } else {
                        if (msg.author.id !== config.infinity.manager)
                            return;

                        const num = matchInteger(match[2]);
                        if (num === null)
                            return;

                        const type = match[1];

                        switch (type) {
                            case "current":
                                await redis.set(rKeys.infinity.current, num);
                                await msg.reply(`The current number is ${num}.`);
                                break;
                            case "goal":
                                await redis.set(rKeys.infinity.goal, num);
                                await msg.reply(`The goal is now ${num}.`);
                                break;
                            case "factor":
                                await redis.set(rKeys.infinity.factor, num);
                                await msg.reply(`The factor is now ${num}. That means after this goal (${goal}), the next goal is ${goal * factor}.`);
                                break;
                        }
                    }
                });

            client.login(config.token);
        }

    };
}