import { Environment } from '../discord';
import { Guild, Role } from 'discord.js';

export interface Roles {
    channel: string;
};

export async function apply(env: Environment) {
    const [config, client, redis] = [env.config, env.client, env.redis];

    const rKeys = {
        role(id: string): string {
            return `role:${id}`;
        },
        roles: 'roles'
    };

    const messages = {
        roleAlreadyCreate: 'You already have a role! Modify it with /role color {r} {g} {b} and /role name {name} or remove it with /role remove.',
        notGuildMemeber: 'Not a guild member. Please contact an administrator.',
        createdRole: 'Created a new role!',
        noRoleToDelete: 'You don\'t have a role to delete!',
        discordRoleNotFound: 'Discord role not found.',
        deletedRole: 'Deleted role!',
        illegalName: 'You can\'t make a role with that name!',
        createRole: 'You don\'t have a role! Make one first with /role create.',
        resolveIdFailed: 'Couldn\'t resolve role from id.',
        invalidColor: 'Invalid color'
    };

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

            const match = msg.content.match(/\/role\s(create|remove|name|color)\s?(.*)?/);
            if (match === null)
                return;

            const type = match[1].toLowerCase();
            const rest = match[2];

            const roleKey = rKeys.role(msg.author.id);

            const getRole = async (): Promise<Role | null> => {
                const roleId = await redis.get(roleKey);
                if (roleId === null) {
                    await msg.reply(messages.createRole);
                    return null;
                }
                const role = guild.roles.resolve(roleId);
                if (role === null) {
                    await msg.reply(messages.resolveIdFailed);
                    return null;
                }
                return role;
            };

            type Triple = [number, number, number];

            const colorDistance = (a: Triple, b: Triple, w: Triple = [1, 1, 1]): number => {
                const [r1, g1, b1] = [a[0], a[1], a[2]];
                const [r2, g2, b2] = [b[0], b[1], b[2]];
                return (w[0] * (r1 - r2) ** 2 + w[1] * (g1 - g2) ** 2 + w[2] * (b1 - b2) ** 2) ** 0.5;
            };

            const colorDistanceWeighted = (rgb: Triple): number => {
                const confessRGB: Triple = [149, 53, 44];
                return colorDistance(confessRGB, rgb) < 128
                    ? colorDistance(confessRGB, rgb, [2, 4, 3])
                    : colorDistance(confessRGB, rgb, [3, 4, 2]);
            };

            switch (type) {
                case 'create':
                    {
                        if (await redis.exists(roleKey) === 1) {
                            await msg.reply(messages.roleAlreadyCreate);
                            return;
                        }
                        const role = await guild.roles.create({
                            data: {
                                name: msg.author.username
                            }
                        });
                        const member = guild.member(msg.author);
                        if (member === null) {
                            await msg.reply(messages.notGuildMemeber);
                            return;
                        }
                        await member.roles.add(role);
                        await redis.set(roleKey, role.id);
                        await msg.reply(messages.createdRole);
                        break;
                    };
                case 'remove':
                    {
                        const roleId = await redis.get(roleKey);
                        if (roleId === null) {
                            await msg.reply(messages.noRoleToDelete);
                            return;
                        }

                        await redis.del(roleKey);

                        const role = guild.roles.resolve(roleId);
                        if (role === null) {
                            await msg.reply(messages.discordRoleNotFound);
                            return;
                        }

                        await role.delete();
                        await msg.reply(messages.deletedRole);
                    };
                    break;
                case 'name':
                    {
                        const role = await getRole();
                        if (role === null)
                            return;

                        if (rest.trim().length === 0 || rest.match(/confess/i) !== null) {
                            await msg.reply(messages.illegalName);
                            return;
                        }

                        await role.setName(rest);
                        await msg.reply(`Set name to ${rest}!`);
                    };
                    break;
                case 'color':
                    {
                        const role = await getRole();
                        if (role === null)
                            return;

                        const colorMatch = rest.match(/\d{1,3}/g);
                        if (colorMatch === null || colorMatch.length !== 3) {
                            await msg.reply(messages.invalidColor);
                            return;
                        }

                        const colors = colorMatch.map(a => parseInt(a)).filter(a => !isNaN(a) && a >= 0 && a <= 255);
                        if (colors.length !== 3) {
                            await msg.reply(messages.invalidColor);
                            return;
                        }

                        const triple = colors as Triple;

                        const distance = colorDistanceWeighted(triple);
                        if (distance < 100) {
                            await msg.reply(`The color (${triple}) is too similar to my color! (delta: ${distance} is not >= 100)`);
                            return;
                        }

                        await role.setColor(triple);
                        await msg.reply(`Set color to ${triple}!`);
                    };
                    break;
            }
        });
};