import { Client } from 'discord.js';

import Redis from 'ioredis';

import { Confession, apply as confession } from './handlers/confession';
import { Infinity, apply as infinity } from './handlers/infinity';
import { Roles, apply as roles } from './handlers/role';

export interface DiscordConfig {
    token: string;
    guild: string;
    confess: Confession;
    infinity: Infinity;
    roles: Roles;
};

export interface Environment {
    config: DiscordConfig;
    client: Client;
    redis: Redis.Redis;
};

export const DiscordAgent = async (config: DiscordConfig) => {
    const client = new Client({ partials: ['MESSAGE', 'REACTION'] });
    const redis = new Redis(process.env.REDIS_URL);

    const env: Environment = {
        client,
        redis,
        config
    };

    return {
        async start() {
            await confession(env);
            await infinity(env);
            await roles(env);

            await client.login(config.token);
        }
    };
}