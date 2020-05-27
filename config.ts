import { Configuration } from './src/index';

export const config: Configuration = {
    // Discord bot token
    token: 'insert token here',
    // A map of all targets the bot should listen to
    targets: {
        // Guild ID
        'insert guild id here': [
            // A list of channel ID's
            'insert channel id here',
            'and here...'
        ]
    },
    // How often edit history should be pruned in minutes
    pruneInterval: 10
}