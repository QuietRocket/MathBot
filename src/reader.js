const readline = require('readline')
const katex = require('katex')

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

rl.on('line', (input) => {
    const out = katex.renderToString(input, {
        output: 'html'
    });
    console.log(out);
})