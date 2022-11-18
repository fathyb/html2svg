import { app, BrowserWindow } from 'electron'

export interface Options {
    full?: boolean
    wait?: number
    width?: number
    height?: number
    format?: 'svg' | 'pdf' | 'png' | 'jpg' | 'webp'
}

app.dock?.hide()
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('headless')
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-gpu')

export async function html2svg(
    url: string,
    { full, wait, width, height, format }: Options = {},
) {
    const mode = getMode(format ?? 'svg')

    await app.whenReady()

    const page = new BrowserWindow({
        width,
        height,
        show: false,
        webPreferences: {
            sandbox: false,
            offscreen: true,
            additionalArguments:
                format === 'svg'
                    ? ['--html2svg-svg-mode', '--disable-remote-fonts']
                    : [],
        },
    })

    try {
        await new Promise<void>((resolve, reject) =>
            Promise.resolve()
                .then(async () => {
                    const timeout = setTimeout(() => {
                        page.webContents.off('did-finish-load', listener)

                        reject(new Error('timeout'))
                    }, 10_000)
                    const listener = () => {
                        clearTimeout(timeout)

                        resolve()
                    }

                    page.webContents.once('did-finish-load', listener)

                    await page.loadURL(url)
                })
                .catch(reject),
        )

        await page.webContents.executeJavaScript(
            `
                    new Promise(resolve => {
                        const style = document.createElement('style')

                        style.innerHTML = trustedTypes
                            .createPolicy('html2svg/scrollbar-css', { createHTML: x => x })
                            .createHTML(\`
                                *::-webkit-scrollbar,
                                *::-webkit-scrollbar-track,
                                *::-webkit-scrollbar-thumb {
                                    display: none;
                                }
                            \`)

                        document.head.appendChild(style)
                        scrollTo({ top: document.body.scrollHeight })

                        requestAnimationFrame(() => {
                            scrollTo({ top: 0 })

                            requestAnimationFrame(() =>
                                setTimeout(resolve, ${(wait ?? 0) * 1000})
                            )
                        })
                    }).then(() =>
                        getPageContentsAsSVG(
                            ${full ? 0 : height} * devicePixelRatio,
                            ${mode},
                            document.title,
                        )
                    )
                `,
        )
    } finally {
        page.destroy()
    }
}

function getMode(format: string) {
    switch (format) {
        case 'svg':
            return 0
        case 'pdf':
            return 1
        case 'png':
            return 2
        case 'jpg':
        case 'jpeg':
            return 3
        case 'webp':
            return 4
        default:
            throw new Error(`Unsupported output format: ${format}`)
    }
}
