import { Client, DMChannel } from 'discord.js';

import LatexAgent from '../latex';

export default class DiscordAgent extends LatexAgent {
    private token: string;
    private client: Client;

    constructor(token: string) {
        super();
        this.token = token;
        this.client = new Client();
    }

    async start() {
        if (!this.initialized)
            await this.init();

        this.client.on('message', async (msg) => {
            if (!(msg.channel instanceof DMChannel))
                return

            console.log(msg.content);
            try {
                const result = await this.render(msg.content);
                msg.channel.sendFile(result);
            } catch (e) {
                console.error(e);
            }
        });
        this.client.login(this.token);
    }

}