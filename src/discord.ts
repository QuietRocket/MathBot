import { Client, Guild } from 'discord.js';

import Redis from 'ioredis';

import { Confession, apply as confession } from './handlers/confession';
import { Infinity, apply as infinity } from './handlers/infinity';
import { Roles, apply as roles } from './handlers/role';
import { Drawing, apply as drawing } from './handlers/drawings';
import { Confesation, apply as confesation } from './handlers/confesation';

import { Express } from 'express';
import { app as web } from './web';

export interface DiscordConfig {
    token: string;
    guild: string;
    confess: Confession;
    infinity: Infinity;
    roles: Roles;
    drawing: Drawing;
    confesation: Confesation;
};

export interface Environment {
    config: DiscordConfig;
    client: Client;
    redis: Redis.Redis;
    web: Express;
    guild: Guild;
};

export const DiscordAgent = (config: DiscordConfig) => {
    const client = new Client({ partials: ['MESSAGE', 'REACTION'] });
    const redis = new Redis(process.env.REDIS_URL);

    const envPartial = {
        config,
        client,
        redis,
        web
    };

    return {
        start() {
            client.on('ready', async () => {
                const guild = client.guilds.resolve(config.guild) as Guild;
                if (guild === null)
                    throw Error('Couldn\'t resolve guild.');

                const env: Environment = {
                    ...envPartial,
                    guild
                };

                await confession(env);
                await infinity(env);
                await roles(env);
                await drawing(env);
                await confesation(env);
            });

            client.login(config.token);
        }
    };
}