import { DiscordConfig } from './src/discord';

export const config: DiscordConfig = {
    // Discord bot token
    token: 'insert token here',
    // Guild id
    guild: 'insert guild id here',
    // Confession settings
    confess: {
        // Where should confession moderation happen?
        moderation: 'insert channel id',
        // Where should accepted confessions be posted?
        output: 'insert channel id',
        // Message asking user to confirm their submission.
        messageVerify: 'Are you sure you want to submit this confession? Click the 👍 within one minute to proceed, or wait to cancel.',
        // How long users should have to confirm submission before timeout in seconds.
        messageVerifyTimeout: 60,
        // Timeout message.
        messageCancel: 'No reactions detected. Canceling confession.',
        // Successful submission of confession.
        messageSent: 'Thank you for your anonymous submission. Moderators will review your submission at their leisure.'
    },
    // Infinity settings
    infinity: {
        channel: 'channel id',
        manager: 'manager id'
    },
    // Roles settings
    roles: {
        channel: 'channel id'
    }
}