import {
    chromium,
    Route,
    Request
} from 'playwright-chromium';
import { renderToString } from 'katex';
import path from 'path';
import url from 'url';

export const LatexEngine = async (debug?: boolean) => {
    const browser = await chromium.launch({
        headless: !debug,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext();

    await context.route(
        () => true,
        async (route: Route, request: Request) => {
            const uri = url.parse(request.url());
            if (uri.path === null)
                return;
            const match = uri.path.match(/^\/katex(.*)/)
            if (match) {
                route.fulfill({
                    path: path.join(
                        __dirname,
                        '../node_modules/katex/dist',
                        match[1]
                    )
                });
            } else {
                route.fulfill({
                    path: path.join(
                        __dirname,
                        "../static",
                        uri.path
                    )
                });
            }
        });
    
    return {
        async render(expressions: string[]): Promise<Buffer> {
            let outputs: string[] = expressions.map(expression => renderToString(expression, {
                displayMode: true,
                output: 'html'
            }));
    
            const page = await context.newPage();
    
            await page.goto('http://latex.bot/page.html');
    
            await page.evaluate((args) => {
                const container = document.createElement('div');
                container.innerHTML = args.outputs.join('\n');
                container.classList.add('container');
                if (args.debug)
                    container.classList.add('debug');
                document.body.appendChild(container);
            }, { outputs, debug });
    
            await (new Promise((resolve) => setTimeout(resolve, 100)));
    
            const clip = await page.evaluate(() => {
                const { x, y, width, height } = document.getElementsByClassName('container')[0].getBoundingClientRect();
                return { x, y, width, height };
            });
    
            const buffer = await page.screenshot({
                omitBackground: true,
                clip
            });
    
            if (!debug)
                await page.close();
    
            return buffer;
        },

        async destroy() {
            await context.close();
            await browser.close();
        }
    };
}