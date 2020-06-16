import {
    Client,
    MessageOptions,
    Message,
    PartialMessage,
    TextChannel,
    DMChannel,
    MessageReaction,
    User,
    MessageEmbed
} from 'discord.js';

import { LatexEngine } from '../latex';

import { ParseError } from 'katex';

export interface DiscordConfig {
    token: string;
    targets: DiscordTargets;
    pruneInterval: number;
    confess: Confess;
}

export interface DiscordTargets {
    [key: string]: string[];
}

export interface Confess {
    moderation: string;
    output: string;
    messageVerify: string;
    messageVerifyTimeout: number;
    messageCancel: string;
    messageSent: string;
}

export const DiscordAgent = async (config: DiscordConfig, debug?: boolean) => {
    const engine = await LatexEngine(debug);
    const client = new Client({ partials: ['MESSAGE', 'REACTION'] });
    const messageMap: Map<string, Message> = new Map();
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const pruneMap = () => {
        if (messageMap.size === 0)
            return;

        const now = Date.now();

        Array.from(messageMap.entries())
            .filter((value) => {
                const delta = now - value[1].createdTimestamp;
                return delta / 1000 >= 60 * config.pruneInterval;
            })
            .forEach((value) => {
                messageMap.delete(value[0]);
            });

        if (messageMap.size === 0) {
            timeout = null;
            return;
        }

        const oldest = Math.min.apply(null, Array.from(messageMap.values()).map((message) => message.createdTimestamp));
        const next = 60 * config.pruneInterval - (now - oldest) / 1000

        timeout = setTimeout(() => pruneMap(), 1000 * next);
    }

    const trackMessage = (id: string, message: Message) => {
        messageMap.set(id, message);
        if (timeout === null)
            timeout = setTimeout(() => pruneMap(), 1000 * 60 * config.pruneInterval);
    }

    const handleMessage = async (content: string): Promise<MessageOptions | string | null> => {
        let reply: MessageOptions | string | null = null;

        const matches = content.matchAll(/\$(.+?)\$/g);
        const expressions = Array.from(matches).map((match) => match[1]);

        if (expressions.length === 0)
            return reply;

        try {
            const result = await engine.render(expressions);
            reply = {
                files: [
                    result
                ]
            };
        } catch (e) {
            if (e instanceof ParseError)
                reply = '```\n' + e.message + '\n```';
            else
                console.error(e);
        } finally {
            return reply;
        }
    }

    const shouldIgnore = (msg: Message | PartialMessage): boolean => {
        if (
            !(msg.channel instanceof TextChannel) ||
            msg.guild === null ||
            !config.targets.hasOwnProperty(msg.guild.id) ||
            msg.author === null ||
            client.user === null ||
            msg.author.id === client.user.id
        )
            return true;

        const guild = config.targets[msg.guild.id];
        if (guild.indexOf(msg.channel.id) === -1)
            return true;

        return false;
    }

    const sendResult = async (msg: Message | PartialMessage) => {
        if (msg.content === null)
            return;

        const result = await handleMessage(msg.content);

        if (result === null)
            return;

        const reply = await msg.channel.send(result);

        trackMessage(msg.id, reply);
    }

    // Confession stuff

    let modChannel: TextChannel;
    let outChannel: TextChannel;
    const emojis = {
        'check': '✅',
        'cross': '🚫',
        'send': '📨',
        'thumb': '👍',
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

    return {
        start() {
            client
                .on('message', async (msg) => {
                    if (shouldIgnore(msg))
                        return;

                    await sendResult(msg);
                })
                .on('messageUpdate', async (_, msg) => {
                    const id = msg.id;
                    if (!messageMap.has(id) || msg.content === null)
                        return;

                    await messageMap.get(id)!.delete();

                    await sendResult(msg);
                })
                .on('messageDelete', async (msg) => {
                    const id = msg.id;
                    if (!messageMap.has(id))
                        return;

                    await messageMap.get(id)!.delete();
                    messageMap.delete(id);
                })
                .on('disconnect', async () => {
                    await engine.destroy();
                    client.destroy();
                });
            
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
                        ![emojis.check, emojis.cross].includes(reaction.emoji.name)
                    )
                        return;

                    if (reaction.partial) {
                        try {
                            await reaction.fetch();
                        } catch (e) {
                            console.dir(e);
                            return;
                        }
                    }

                    if (reaction.emoji.name === emojis.cross) {
                        await reaction.message.delete();
                    } else if (reaction.emoji.name === emojis.check) {
                        const msg = reaction.message;
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
                        await reaction.message.react(emojis.send);
                    }
                });

            client.login(config.token);
        }

    };
}