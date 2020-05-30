import { LatexEngine } from '../latex';

import path from 'path';
import { promises as fs } from 'fs';
import { createInterface } from 'readline';
import { ParseError } from 'katex';

export const ReplAgent = async (debug?: boolean) => {
    const engine = await LatexEngine(debug);

    return {
        async start() {
            createInterface({
                input: process.stdin,
                output: process.stdout
            }).on('line', async (input: string) => {
                const matches = input.matchAll(/\$(.+?)\$/g);
                const expressions = Array.from(matches).map((match) => match[1]);
                try {
                    const result = await engine.render(expressions);
                    await fs.writeFile(path.join(__dirname, `../../output/${Date.now()}.png`), result);
                } catch (e) {
                    if (e instanceof ParseError)
                        console.error(e.message);
                    else
                        throw e;
                }
            }).on('close', () => {
                engine.destroy();
            })
        }
    };
}