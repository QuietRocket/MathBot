import { Environment } from '../discord';

export interface Infinity {
    channel: string;
    manager: string;
};

export async function apply(env: Environment) {
    const [config, client, redis] = [env.config, env.client, env.redis];

    const rKeys = {
        current: 'infinity:current',
        goal: 'infinity:goal',
        factor: 'infinity:factor',
        lastId: 'infinity:lastId'
    };

    const emojis = {
        'x': '❌'
    };

    await redis
        .pipeline()
        .setnx(rKeys.current, 0)
        .setnx(rKeys.goal, 1)
        .setnx(rKeys.factor, 2)
        .exec();

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
                .get(rKeys.current)
                .get(rKeys.goal)
                .get(rKeys.factor)
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
                const lastId = await redis.get(rKeys.lastId);
                if (authorId === lastId) {
                    await msg.reply('You already went your turn!');
                    return;
                }

                if (num === correct) {
                    await redis.incr(rKeys.current);
                } else {
                    await msg.react(emojis.x);
                }

                if (current === goal) {
                    await msg.channel.send(`Woohoo! The goal of ${goal} was met! The next goal is ${nextGoal} (factor: x${factor}).`);
                    await redis.set(rKeys.goal, nextGoal);
                }

                await redis.set(rKeys.lastId, authorId);
            } else {
                if (msg.author.id !== config.infinity.manager)
                    return;

                const num = matchInteger(match[2]);
                if (num === null)
                    return;

                const type = match[1];

                switch (type) {
                    case "current":
                        await redis.set(rKeys.current, num);
                        await msg.reply(`The current number is ${num}.`);
                        break;
                    case "goal":
                        await redis.set(rKeys.goal, num);
                        await msg.reply(`The goal is now ${num}.`);
                        break;
                    case "factor":
                        await redis.set(rKeys.factor, num);
                        await msg.reply(`The factor is now ${num}. That means after this goal (${goal}), the next goal is ${goal * factor}.`);
                        break;
                }
            }
        });
};