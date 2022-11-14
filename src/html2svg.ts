import { app, BrowserWindow } from 'electron'

const entry = process.argv.find(a => a.endsWith('html2svg.js'))
const index = entry ? process.argv.indexOf(entry) : -1
const args = process.argv.slice(Math.max(2, index + 1))
const [url] = args

if (!url) {
	throw new Error('Usage: html2svg [url]')
}

app.dock?.hide()
app.whenReady()
    .then(async () => {
        const page = new BrowserWindow({
            show: false,
            width: 1920,
            height: 1080,
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

            return await page.webContents.executeJavaScript(
                `
                    new Promise(resolve => {
                        const style = document.createElement('style')

                        style.innerHTML = \`
                            body::-webkit-scrollbar, body::-webkit-scrollbar-track, body::-webkit-scrollbar-thumb {
                                display: none;
                            }
                        \`

                        document.head.appendChild(style)
                        scrollTo({ top: document.body.scrollHeight })

                        requestAnimationFrame(() => {
                            scrollTo({ top: 0 })

                            setTimeout(() => {
                                requestAnimationFrame(resolve)
                            }, 1000)
                        })
                    }).then(getPageContentsAsSVG)
                `,
            )
        } finally {
            page.destroy()
        }
    })
    .then((result) => {
        console.log(result)

        process.exit(0)
    })
    .catch((error) => {
        console.error(error)

        process.exit(1)
    })
