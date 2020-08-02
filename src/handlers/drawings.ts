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
        const actionBuffer: number[] = req.body;

        const size = 1000;

        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, size, size);

        if (actionBuffer.length === 0) {
            res.status(400);
            res.send('No artwork sent.');
            return;
        }

        let lastStroked = false;
        let success = true;

        let i = 0;
        while (i < actionBuffer.length && success) {
            const type = actionBuffer[i];
            i++;

            if (type <= -1 && type >= -3) {
                const [x, y] = [actionBuffer[i], actionBuffer[i + 1]].map(i => i * size);
                i += 2;

                switch (type) {
                    case -1: // down
                        {
                            ctx.beginPath();
                            ctx.moveTo(x, y);
                            lastStroked = false;
                        };
                        break;
                    case -2: // move
                        {
                            ctx.lineTo(x, y);
                        };
                        break;
                    case -3: // up
                        {
                            ctx.lineTo(x, y);
                            ctx.stroke();
                            lastStroked = true;
                        };
                        break;
                }
            } else {
                switch (type) {
                    case -4: // line width
                        {
                            const value = actionBuffer[i];
                            i += 1;
                            const norm = (value - 50) / 50;
                            const target = size / 75;
                            ctx.lineWidth = target + 10 * norm;
                        };
                        break;
                    case -5: // color
                        {
                            let color: string;
                            const raw = actionBuffer[i];
                            if (raw === 0) {
                                color = '#000';
                            } else {
                                color = '#' + actionBuffer[i].toString(16);
                            }
                            i += 1;
                            ctx.strokeStyle = color;
                        };
                        break;
                    default:
                        {
                            console.log('Something went wrong!');
                            success = false;
                        };
                        break;
                };
            }
        }

        if (!success) {
            res.status(400);
            res.send('Problem when interpreting artwork.');
            return;
        }

        if (!lastStroked)
            ctx.stroke();

        const buffer = canvas.toBuffer('image/jpeg', {
            quality: 1
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

        res.end();
    });
};