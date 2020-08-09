import { Environment } from '../discord';
import { DMChannel, Role } from 'discord.js';
import { Router } from 'express';
import { randomBytes, createHmac, createHash } from 'crypto';

export interface Verify {
    handler: (token: string) => string;
    script: (token: string) => string;
    secret: string;
    role: string;
};

export async function apply(env: Environment) {
    const [config, web, client, redis, guild] = [env.config, env.web, env.client, env.redis, env.guild];

    const rKeys = {
        verifySession(token: string) {
            return `verify:sessions:${token}`;
        },
        verify: 'verify'
    };

    let verifyRole = guild.roles.resolve(config.verify.role) as Role;
    if (verifyRole === null)
        throw Error('Couldn\'t resolve verify role.');

    client.on('message', async (msg) => {
        if (
            !(msg.channel instanceof DMChannel) ||
            msg.author.bot ||
            !msg.content.startsWith('/verify')
        )
            return;

        const userId = msg.author.id;

        const verified = await redis.hget(rKeys.verify, userId);

        if (verified !== null) {
            await msg.channel.send('You\'re already verified!');
            const guildMember = guild.member(userId);
            if (guildMember !== null) {
                await guildMember.roles.add(verifyRole);
            }
            return;
        }

        const token = randomBytes(20).toString('hex');

        const timeout = 60 * 10;

        await redis.set(rKeys.verifySession(token), userId, 'EX', timeout);

        await msg.channel.send(`Please click the following link to verify: ${config.verify.handler(token)}`);
    });

    const router = Router();

    router.get('/:token', async (req, res) => {
        const token = req.params.token;
        const exists = await redis.get(rKeys.verifySession(token));
        if (exists === null) {
            res.send(`The provided token (${token}) is invalid. Please generate a new one through discord.`);
            return;
        }

        res.redirect(config.verify.script(token));
    });

    router.get('/', async (req, res) => {
        const { id, token, hmac } = req.query;

        const error = (msg: string) => {
            res.status(500);
            res.send(msg);
        };

        if (!id || !token || !hmac)
            return error('Not all request parameters were satisfied.')

        const idString = `${id}`;
        const tokenString = `${token}`;
        const hmacString = `${hmac}`;

        const localHmac = createHmac('sha256', config.verify.secret).update(idString).digest('hex');

        if (hmacString != localHmac)
            return error('Integrity test failed.');

        const sessionId = rKeys.verifySession(tokenString);

        const userId = await redis.get(sessionId);

        if (userId === null)
            return error('The token is invalid.');
        
        await redis.del(sessionId);

        const hashedId = createHash('md5').update(idString).digest('hex');

        const ids = await redis.hvals(rKeys.verify);
        if (ids.indexOf(hashedId) !== -1)
            return error('This ID was already used to verify an account. If you think this is a mistake, please contact the admin on discord.');

        await redis.hset(rKeys.verify, userId, hashedId);

        const guildMember = guild.member(userId);
        if (guildMember === null)
            return error('User not found.');

        guildMember.send('You have successfully verified!');
        guildMember.roles.add(verifyRole);

        res.send('Successfully verified.');
    });

    web.use('/verify', router);
};