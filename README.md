# MathBot

MathBot is a LaTeX rendering Discord bot based on Katex

## Installation
TO-DO

## Dependencies
- [KaTeX](https://github.com/KaTeX/KaTeX) to parse LaTeX expressions and convert them to HTML
- [Playwright](https://github.com/microsoft/playwright/) to render pages in a headless browser
- [Discord.js](https://github.com/discordjs/discord.js/) to deliver the rendered results as a Discord bot

## Rendering Overview
This renderer leverages web technologies internally in order to make it light weight compared to other TeX systems.

1. A headless chromium browser session is initialized using playwright which stays on during the lifetime of the application.
2. On each render request, the LaTeX string is parsed on the server using Katex and translated into HTML.
3. The HTML is then injected into a new web page with the required stylesheets and fonts specified by Katex.
4. The portion of the web page containing the rendered LaTeX is then screenshotted with a transparent background.
5. The screenshot is then returned as an image buffer, where it can then be saved, sent through discord.js, etc.