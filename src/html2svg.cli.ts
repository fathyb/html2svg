import { join } from 'path'
import { spawn } from 'child_process'
import { tmpdir } from 'os'
import { request } from 'http'
import { program } from 'commander'
import { pipeline } from 'stream/promises'
import { mkdir, rm } from 'fs/promises'
import { randomBytes } from 'crypto'
import { ListenOptions } from 'net'

if (require.main === module) {
    const entry = process.argv.find((a) => a.endsWith(__filename))
    const index = entry ? process.argv.indexOf(entry) : -1
    const args = process.argv.slice(Math.max(2, index + 1))

    cli(args)
        .then(() => process.exit(0))
        .catch((error) => {
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
            const id = Array.from(randomBytes(16))
                .map((x) => x.toString(36).padStart(2, '0'))
                .join('')
            const dir = join(tmpdir(), 'html2svg-server')
            const path = join(dir, `${id}.sock`)

            await mkdir(dir, { recursive: true })

            const server = serve({ path })

            await Promise.all([
                server.wait(),
                Promise.resolve().then(async () => {
                    const start = Date.now()

                    while (Date.now() - start < 10_000) {
                        const done = await new Promise<boolean>(
                            (resolve, reject) =>
                                request({ method: 'POST', socketPath: path })
                                    .on('error', (error: any) => {
                                        if (error?.code === 'ENOENT') {
                                            resolve(false)
                                        } else {
                                            reject(error)
                                        }
                                    })
                                    .on('response', (res) => {
                                        if (res.statusCode === 200) {
                                            pipeline(res, process.stdout).then(
                                                () => resolve(true),
                                                reject,
                                            )
                                        } else {
                                            throw new Error(
                                                `Server error ${res.statusCode}`,
                                            )
                                        }
                                    })
                                    .end(JSON.stringify({ url, ...options })),
                        )

                        if (done) {
                            return server.process.kill()
                        } else {
                            await sleep(100)
                        }
                    }

                    throw new Error('Timed out waiting for server to start')
                }),
            ]).finally(async () => await rm(path, { force: true }))
        })

    program
        .command('serve')
        .option(
            '-H, --host <hostname>',
            'set the hostname to listen on',
            'localhost',
        )
        .option(
            '-p, --port <hostname>',
            'set the port to listen on',
            validateInt,
            8080,
        )
        .option('-u, --unix <path>', 'set the unix socket to listen on')
        .action(
            async ({ host, port, unix }) =>
                await serve(unix ? { path: unix } : { host, port }).wait(),
        )

    await program.parseAsync(args, { from: 'user' })
}

function validateInt(string: string) {
    const number = parseInt(string, 10)

    if (Number.isNaN(number)) {
        throw new Error(`Invalid number value: ${string}`)
    }

    return number
}

async function sleep(ms: number) {
    await new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function serve(options: ListenOptions) {
    const child = spawn(
        require.resolve('./runtime/electron'),
        ['--no-sandbox', require.resolve('./html2svg.server')],
        {
            env: {
                ...process.env,
                HTML2SVG_SERVER_OPTIONS: JSON.stringify(options),
            },
        },
    )

    return {
        process: child,
        async wait() {
            await new Promise<void>((resolve, reject) =>
                child.on('error', reject).on('close', (code, signal) => {
                    if (signal) {
                        reject(new Error(`Server quit with signal ${signal}`))
                    } else if (code !== 0) {
                        reject(new Error(`Server quit with code ${code}`))
                    } else {
                        resolve()
                    }
                }),
            )
        },
    }
}
