import {
    ChromiumBrowser,
    ChromiumBrowserContext,
    chromium,
    Route,
    Request
} from 'playwright';
import katex from 'katex';
import path from 'path';
import url from 'url';

export default abstract class LatexAgent {
    private browser?: ChromiumBrowser;
    private context?: ChromiumBrowserContext;
    
    protected get initialized(): boolean {
        return this.browser !== undefined && this.context !== undefined;
    }

    protected async init() {        
        this.browser = await chromium.launch({ headless: true });
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

    protected async render(expression: string): Promise<Buffer> {
        let output: string;

        output = katex.renderToString(expression, {
            displayMode: true,
            output: 'html'
        });

        if (!this.initialized)
            throw new Error('Agent not initialzed.')

        const page = await this.context!.newPage();

        await page.goto('http://latex.bot/page.html');

        await page.evaluate((text) => {
            document.body.innerHTML = text;
        }, output);

        const clip = await page.evaluate(() => {
            const { height, width, x, y } = document.getElementsByClassName('katex-html')[0].getBoundingClientRect()
            return { height, width, x, y };
        });

        const buffer = await page.screenshot({
            omitBackground: true,
            clip
        });

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
}