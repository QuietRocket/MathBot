import { Client, MessageOptions, TextChannel } from 'discord.js';

import LatexAgent from '../latex';

import { ParseError } from 'katex';

export interface DiscordTargets {
    [key: string]: string[];
}

export default class DiscordAgent extends LatexAgent {
    private token: string;
    private client: Client;
    private targets: DiscordTargets;

    constructor(token: string, targets: DiscordTargets) {
        super();
        this.token = token;
        this.client = new Client();
        this.targets = targets;
    }

    async start() {
        if (!this.initialized)
            await this.init();

        this.client
            .on('message', async (msg) => {
                if (!(msg.channel instanceof TextChannel))
                    return;

                if (!this.targets.hasOwnProperty(msg.guild.id))
                    return;

                const guild = this.targets[msg.guild.id] as string[];
                if (guild.indexOf(msg.channel.id) === -1)
                    return;

                const match = msg.content.match(/\.tex (.*)/);
                if (!match)
                    return;

                try {
                    const result = await this.render(match[1]);
                    const options: MessageOptions = {
                        files: [
                            result
                        ]
                    }
                    msg.reply(options);
                } catch (e) {
                    if (e instanceof ParseError)
                        msg.reply('```\n' + e.message + '\n```');
                    else
                        console.error(e);
                }
            })
            .on('disconnect', async () => {
                await this.destroy();
                await this.client.destroy();
            })

        this.client.login(this.token);
    }

}