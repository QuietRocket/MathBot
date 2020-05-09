const { chromium } = require('playwright');
const katex = require('katex');

const path = require('path');
const url = require('url');

async function configureBrowser() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { height: 1000, width: 1000 }
    });

    await context.route(
        (url) => url.host === 'latex.bot'
        , async (route, request) => {
            const uri = url.parse(request.url());
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
        browser,
        context
    }
}

async function render(context, input) {
    const page = await context.newPage();

    let output;

    try {
        output = katex.renderToString(input, {
            displayMode: true,
            output: 'html'
        });
    } catch {
        process.exit();
    }

    await page.goto('http://latex.bot/page.html');

    await page.evaluate((text) => {
        document.body.innerHTML = text;
    }, output);

    const clip = await page.evaluate(() => {
        const { height, width, x, y } = document.getElementsByClassName('katex-html')[0].getBoundingClientRect()
        return { height, width, x, y };
    });

    await page.screenshot({
        path: path.join(__dirname, `../output/${Date.now()}.png`),
        omitBackground: true,
        clip
    })

    await page.close();
}

(async () => {
    const { browser, context } = await configureBrowser();

    require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    }).on('line', (input) => {
        render(context, input);
    }).on('close', () => {
        browser.close();
    })
})()