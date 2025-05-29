import { BrowserWindow } from 'electron'
import * as path from 'path'

let settingsWindow: BrowserWindow | null = null

const showDevTools =
    process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true'

export default function createSettingsWindow() {
    if (settingsWindow) {
        settingsWindow.focus()
        return
    }

    settingsWindow = new BrowserWindow({
        width: 350,
        height: 600,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    })

    settingsWindow.loadFile(path.join(__dirname, '../public/settings.html'))

    //show devtools
    if (showDevTools) {
        settingsWindow.webContents.openDevTools({
            mode: 'detach', // Open in a separate window
        })
    }

    settingsWindow.on('closed', () => {
        settingsWindow = null
    })

    settingsWindow.on('show', () => showDeviceLabels(true))
    settingsWindow.on('hide', () => showDeviceLabels(false))
    settingsWindow.on('close', () => showDeviceLabels(false))
}

function showDeviceLabels(show: boolean) {
    global.deviceWindows.forEach((win, deviceId) => {
        win.webContents.send('showDeviceLabel', { deviceId, show })
    })
}
