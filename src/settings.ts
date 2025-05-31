import { BrowserWindow } from 'electron'
import * as path from 'path'

let settingsWindow: BrowserWindow | null = null

import { showDeviceLabels } from './utils' // Import the function to show/hide device labels

const showDevTools =
    process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true'

export default function createSettingsWindow() {
    if (settingsWindow) {
        //show the existing window if it exists
        if (settingsWindow.isMinimized()) {
            settingsWindow.restore()
        }
        if (!settingsWindow.isVisible()) {
            settingsWindow.show()
        }
        settingsWindow.focus()
        return
    }

    settingsWindow = new BrowserWindow({
        width: 450,
        height: 600,
        modal: true,
        parent: global.trayParentWindow,
        resizable: false,
        alwaysOnTop: true,
        minimizable: false,
        maximizable: false,
        title: 'Settings',
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

    global.settingsWindow = settingsWindow
}
