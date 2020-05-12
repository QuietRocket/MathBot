import LatexAgent from '../latex';

import path from 'path';
import { promises as fs } from 'fs';
import { createInterface } from 'readline';
import { ParseError } from 'katex';

export default class ReplAgent extends LatexAgent {
    async start() {
        if (!this.initialized)
            await this.init();
        createInterface({
            input: process.stdin,
            output: process.stdout
        }).on('line', async (input: string) => {
            try {
                const result = await this.render(input);
                await fs.writeFile(path.join(__dirname, `../../output/${Date.now()}.png`), result);
            } catch (e) {
                if (e instanceof ParseError)
                    console.error(e.message);
                else
                    throw e;
            }
        }).on('close', () => {
            this.destroy();
        })
    }
}