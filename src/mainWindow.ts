import { app, BrowserWindow, screen, globalShortcut } from 'electron'
import * as path from 'path'
import Store from 'electron-store'
import { defaultSettings } from './defaults'
import createTray, { updateTrayMenu } from './tray' // Ensure tray management works properly with window events

const store = new Store({ defaults: defaultSettings })

declare global {
    //var mainWindow: BrowserWindow | null
}

export function createMainWindow() {
    const alwaysOnTop = store.get('alwaysOnTop', true)
    const keysTotal = store.get('keysTotal', 6)
    const keysPerRow = store.get('keysPerRow', 1)
    const movable = store.get('movable', false)

    const { width, height } = calculateWindowSize(keysTotal, keysPerRow)
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth } = primaryDisplay.workAreaSize

    if (global.mainWindow) {
        global.mainWindow.close()
        global.mainWindow = null
    }

    global.mainWindow = new BrowserWindow({
        width: width,
        height: height,
        x: screenWidth - width - 20,
        y: 20,
        transparent: true,
        frame: false,
        alwaysOnTop: alwaysOnTop,
        resizable: false,
        skipTaskbar: true,
        movable: movable,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true, // Enable context isolation for security
            nodeIntegration: false, // Disable nodeIntegration for security
        },
    })

    global.mainWindow.loadFile(path.join(__dirname, '../public/index.html'))
    global.mainWindow.setHasShadow(false)

    //show dev tools
    //global.mainWindow.webContents.openDevTools()

    //hide the window until satellite is connected
    global.mainWindow?.hide()

    if (global.satellite?.isConnected) {
        global.mainWindow?.show()
        updateTrayMenu()
    }

    global.mainWindow.on('blur', () => {
        if (!alwaysOnTop) {
            global.mainWindow?.hide()
        }
		updateTrayMenu() // Update tray menu when the window is hidden
    })

	global.mainWindow.on('focus', () => {
		updateTrayMenu() // Update tray menu when the window is focused
	})

	global.mainWindow.on('hide', () => {
		updateTrayMenu() // Update tray menu when the window is hidden
	})

    global.mainWindow.on('close', (event) => {
        event.preventDefault()
        global.mainWindow?.hide()
        updateTrayMenu() // Update tray menu when the window is closed
    })
}

function calculateWindowSize(keysTotal: number, keysPerRow: number) {
    const bitmapSize = store.get('bitmapSize', 72)
    const KEY_WIDTH = bitmapSize
    const KEY_HEIGHT = bitmapSize
    const PADDING = 20
    const GAP = 10
    const rows = Math.ceil(keysTotal / keysPerRow)
    const width = keysPerRow * KEY_WIDTH + (keysPerRow - 1) * GAP + PADDING * 2
    const height = rows * KEY_HEIGHT + (rows - 1) * GAP + PADDING * 2
    return { width, height }
}
