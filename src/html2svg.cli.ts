import { program } from 'commander'

import { html2svg } from './html2svg'

if (require.main === module) {
    const entry = process.argv.find((a) => a.endsWith(__filename))
    const index = entry ? process.argv.indexOf(entry) : -1
    const args = process.argv.slice(Math.max(2, index + 1))

    cli(args).catch((error) => {
        console.error(error)

        process.exit(1)
    })
}

export async function cli(args: string[]) {
    program
        .name('html2svg')
        .showHelpAfterError()
        .showSuggestionAfterError()
        .argument('<url>', 'URL to the web page to render')
        .option('-f, --full', 'capture the entire page')
        .option(
            '-w, --wait <seconds>',
            'set the amount of seconds to wait between the page loaded event and taking the screenshot',
            validateInt,
            1,
        )
        .option(
            '-w, --width <width>',
            'set the viewport width in pixels',
            validateInt,
            1920,
        )
        .option(
            '-h, --height <height>',
            'set the viewport height in pixels',
            validateInt,
            1080,
        )
        .option(
            '-f, --format <format>',
            'set the output format, should one of these values: svg, pdf, png, jpg, webp',
            'svg',
        )
        .action(async (url, options) => {
            await html2svg(url, options)

            process.exit(0)
        })

    await program.parseAsync(args, { from: 'user' })
}

function validateInt(string: string) {
    const number = parseInt(string, 10)

    if (Number.isNaN(number)) {
        throw new Error(`Invalid number value: ${string}`)
    }

    return number
}
