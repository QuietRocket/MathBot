# MathBot
MathBot is a LaTeX rendering Discord bot based on KaTeX

## Installation
Add bot token and target guilds / channels and modify prune interval if needed by editing `config.ts`.

- Bot token: Discord bot token. User tokens aren't accepted.
- Target guilds / channels: The bot only listens to guild and channel id's provided in this section.
    - The target object is a map with keys guild id and value an array of channel id's.
- Prune interval: The bot keeps track of messages that invokes it so that it can respond to message edits. It stops tracking each message every N minutes, specified by the prune interval.

**MAKE SURE TO NEVER ACCIDENTLY COMMIT `config.ts` FILE**

### Normal
Clone the repository locally and configure the bot as said above, then run:
```
npm install
npm start
```

### With Docker (Recommended)
After configuring the bot, while inside the project root, build the image with:
```
docker build -t mathbot .
```
and run with:
```
docker run --rm -it mathbot
```

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
5. The screenshot is then returned as an image buffer, where it can then be saved, sent through discord.js.

## Note
Since the content is trustworthy (all requests are redirected) the chromium instance isn't run in a sandbox, as documented in [Playwright troubleshooting documentation](https://github.com/microsoft/playwright/blob/master/docs/troubleshooting.md#setting-up-chrome-linux-sandbox).