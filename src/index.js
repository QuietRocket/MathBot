const { chromium } = require('playwright');
const katex = require('katex');

const path = require('path');
const url = require('url');

function configureBrowser() {

}

function render(input) {
    
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { height: 500, width: 1000 }
    });

    await context.route(
        (url) => url.host === 'latex.bot'
    , async (route, request) => {
        const uri = url.parse(request.url());
        if (uri.path === '/') {
            const size = 4
            route.fulfill({
                body: `
                <!DOCTYPE html>
                <html>
                    <head>
                        <meta charset="utf-8" />
                        <link rel="stylesheet" href="katex.min.css" />
                        <style>
                            .katex {
                                font-size: ${size}em;
                                color: white;
                            }

                            .base {
                                padding: ${size/16}em ${size/8}em;
                                box-sizing: content-box;
                            }
                        </style>
                    </head>
                    <body></body>
                </html>
                `,
                contentType: 'text/html'
            });
        } else {
            route.fulfill({
                path: path.join(
                    __dirname,
                    '../node_modules/katex/dist',
                    uri.path
                )
            });
        }
    });

    const page = await context.newPage();

    let output;

    try {
        output = katex.renderToString(process.argv[2], {
            displayMode: true,
            output: 'html'
        });
    } catch {
        process.exit();
    }

    await page.goto('http://latex.bot');

    await page.evaluate((text) => {
        document.body.innerHTML = text;
    }, output);

    const clip = await page.evaluate(() => {
        const { height, width, x, y } = document.getElementsByClassName('base')[0].getBoundingClientRect()
        return { height, width, x, y };
    });

    await page.screenshot({
        path: path.join(__dirname, `../output/${Date.now()}.png`),
        omitBackground: true,
        clip
    })

    await browser.close();
})()