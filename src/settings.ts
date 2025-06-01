import { BrowserWindow } from 'electron'
import * as path from 'path'

let settingsWindow: BrowserWindow | null = null

import { showDeviceLabels } from './device' // Import the function to show/hide device labels

import { showDevTools } from './utils' // Import the utility to check if dev tools should be shown

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
        width: 500,
        height: 600,
        alwaysOnTop: true,
        resizable: false,
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
