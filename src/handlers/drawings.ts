import { Environment } from '../discord';
import { TextChannel, MessageEmbed, MessageAttachment } from 'discord.js';

export interface Drawing {
    channel: string;
};

import { createCanvas } from 'canvas';

export async function apply(env: Environment) {
    const [config, web, guild] = [env.config, env.web, env.guild];

    let drawingsChannel = guild.channels.resolve(config.drawing.channel) as TextChannel;
    if (drawingsChannel === null)
        throw Error('Couldn\'t resolve drawing channel.');

    web.post('/submitDrawing', async (req, res) => {
        const actions: number[] = req.body;

        if (
            actions.length % 3 !== 0 ||
            actions.filter((i: any) => typeof i !== 'number').length !== 0
        ) {
            res.status(400);
            res.end();
            return;
        }

        const canvas = createCanvas(500, 500);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';

        ctx.fillRect(0, 0, 500, 500);

        for (let i = 0; i < actions.length; i += 3) {
            const [x, y, type] = [actions[i], actions[i + 1], actions[i + 2]];

            switch (type) {
                case 0: // down
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    break;
                case 1: // move
                    ctx.lineTo(x, y);
                    break;
                case 2: // up
                    ctx.lineTo(x, y);
                    ctx.stroke();
                    break;
            };
        }

        const buffer = canvas.toBuffer('image/jpeg', {
            quality: 0.75
        });

        const embed = new MessageEmbed()
            .attachFiles([
                {
                    attachment: buffer,
                    name: 'drawing.jpg'
                }
            ])
            .setImage('attachment://drawing.jpg');

        await drawingsChannel.send(embed);
        res.send('OK');
    });
};