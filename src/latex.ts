import {
    ChromiumBrowser,
    ChromiumBrowserContext,
    chromium,
    Route,
    Request
} from 'playwright-chromium';
import { renderToString } from 'katex';
import path from 'path';
import url from 'url';

export default abstract class LatexAgent {
    private browser?: ChromiumBrowser;
    private context?: ChromiumBrowserContext;
    private debug: boolean = false;

    protected get initialized(): boolean {
        return this.browser !== undefined && this.context !== undefined;
    }

    protected async init() {
        this.browser = await chromium.launch({
            headless: !this.debug,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.context = await this.browser.newContext();

        await this.context.route(
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
    }

    protected async render(expressions: string[]): Promise<Buffer> {
        let outputs: string[] = expressions.map(expression => renderToString(expression, {
            displayMode: true,
            output: 'html'
        }));

        if (!this.initialized)
            throw new Error('Agent not initialzed.')

        const page = await this.context!.newPage();

        await page.goto('http://latex.bot/page.html');

        await page.evaluate((outputs) => {
            const container = document.createElement('div');
            container.innerHTML = outputs.join('\n');
            container.classList.add('container');
            document.body.appendChild(container);
        }, outputs);

        await (new Promise((resolve) => setTimeout(resolve, 100)));

        const clip = await page.evaluate(() => {
            const { x, y, width, height } = document.getElementsByClassName('container')[0].getBoundingClientRect();
            return { x, y, width, height };
        });

        const buffer = await page.screenshot({
            omitBackground: true,
            clip
        });

        if (!this.debug)
            await page.close();

        return buffer;
    }

    protected async destroy() {
        if (this.context !== undefined) {
            await this.context.close();
            this.context = undefined;
        }
        if (this.browser !== undefined) {
            await this.browser.close();
            this.browser = undefined;
        }
    }

    public setDebug(value?: boolean): void {
        this.debug = value !== undefined ? value : !this.debug;
    }
}