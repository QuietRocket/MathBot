import {
    Client,
    MessageOptions,
    Message,
    PartialMessage,
    TextChannel
} from 'discord.js';

import LatexAgent from '../latex';

import { ParseError } from 'katex';

export interface DiscordTargets {
    [key: string]: string[];
}

export default class DiscordAgent extends LatexAgent {
    private token: string;
    private client: Client;
    private targets: DiscordTargets;
    private pruneInterval: number;
    private messageMap: Map<string, Message>;
    private timeout: ReturnType<typeof setTimeout> | null;

    constructor(token: string, targets: DiscordTargets, pruneInterval: number) {
        super();
        this.token = token;
        this.client = new Client();
        this.targets = targets;
        this.pruneInterval = pruneInterval;
        this.messageMap = new Map();
        this.timeout = null;
    }

    private pruneMap() {
        if (this.messageMap.size === 0)
            return;

        const now = Date.now();

        Array.from(this.messageMap.entries())
            .filter((value) => {
                const delta = now - value[1].createdTimestamp;
                return delta / 1000 >= 60 * this.pruneInterval;
            })
            .forEach((value) => {
                this.messageMap.delete(value[0]);
            });
        
        if (this.messageMap.size === 0) {
            this.timeout = null;
            return;
        }
        
        const oldest = Math.min.apply(null, Array.from(this.messageMap.values()).map((message) => message.createdTimestamp));
        const next = 60 * this.pruneInterval - (now - oldest) / 1000
        
        this.timeout = setTimeout(() => this.pruneMap(), 1000 * next);
    }

    private trackMessage(id: string, message: Message) {
        this.messageMap.set(id, message);
        if (this.timeout === null)
            this.timeout = setTimeout(() => this.pruneMap(), 1000 * 60 * this.pruneInterval);
    }

    private async handleMessage(content: string): Promise<MessageOptions | string | null> {
        let reply: MessageOptions | string | null = null;

        const match = content.match(/\.tex (.*)/);
        if (!match)
            return reply;

        try {
            const result = await this.render(match[1]);
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

    private shouldIgnore(msg: Message | PartialMessage): boolean {
        if (
            !(msg.channel instanceof TextChannel) ||
            msg.guild === null ||
            !this.targets.hasOwnProperty(msg.guild.id) ||
            msg.author === null ||
            this.client.user === null ||
            msg.author.id === this.client.user.id
        )
            return true;

        const guild = this.targets[msg.guild.id];
        if (guild.indexOf(msg.channel.id) === -1)
            return true;

        return false;
    }

    private async sendResult(msg: Message | PartialMessage) {
        if (msg.content === null)
            return;

        const result = await this.handleMessage(msg.content);

        if (result === null)
            return;

        const reply = await msg.channel.send(result);

        this.trackMessage(msg.id, reply);
    }

    async start() {
        if (!this.initialized)
            await this.init();

        this.client
            .on('message', async (msg) => {
                if (this.shouldIgnore(msg))
                    return;

                await this.sendResult(msg);
            })
            .on('messageUpdate', async (_, msg) => {
                if (!this.messageMap.has(msg.id) || msg.content === null)
                    return;
                
                await this.messageMap.get(msg.id)!.delete();

                await this.sendResult(msg);
            })
            .on('messageDelete', async (msg) => {
                const id = msg.id;
                if (!this.messageMap.has(id))
                    return;

                await this.messageMap.get(id)!.delete();
                this.messageMap.delete(id);
            })
            .on('disconnect', async () => {
                await this.destroy();
                this.client.destroy();
            })

        this.client.login(this.token);
    }

}