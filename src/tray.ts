import { Tray, Menu, nativeImage, app } from 'electron'
import * as path from 'path'
import Store from 'electron-store'
import createSettingsWindow from './settings' // Import the createSettingsWindow function

let tray: Tray | null = null
const store = new Store()

export default function createTray() {
    // Create the tray icon using nativeImage and resize it to the desired size
    const image = nativeImage.createFromPath(
        path.join(__dirname, '../assets/tray-icon.png') // Adjust this path as needed
    )
    tray = new Tray(image.resize({ width: 16, height: 16 }))

    tray.setToolTip('ScreenDeck')

    tray.on('click', () => {
        tray?.popUpContextMenu()
    })

    updateTrayMenu()
}

// Function to update the tray menu based on the window state
function updateTrayMenu() {
    if (!tray) {
        console.log('Tray has been destroyed; skipping menu update.')
        return
    }

    // Retrieve stored values
    const companionIP = store.get('companionIP', '127.0.0.1') as string
    const version = app.getVersion()

    // Build context menu with version, IP, and Device ID
    const topMenuItems = [
        { label: `ScreenDeck Version: ${version || ''}`, enabled: false },
        { label: `Companion IP: ${companionIP || ''}`, enabled: false },
        {
            label: `Companion Version: ${global.satelliteClient?.companionVersion || 'Unknown'}`,
            enabled: false,
        },
        {
            label: `Satellite API Version: ${global.satelliteClient?.companionApiVersion || 'Unknown'}`,
            enabled: false,
        },
        {
            label: `Connected: ${global.satelliteClient?.connected ? 'Yes' : 'No'}`,
            enabled: false,
        },
        { type: 'separator' },
    ] as Electron.MenuItemConstructorOptions[]

    const devices = store.get('deviceIds') as string[]
    const deviceMenuItems = devices.map((deviceId) => {
        const win = global.deviceWindows.get(deviceId)
        const isVisible = win?.isVisible() ?? false
        return {
            label: `${isVisible ? 'Hide' : 'Show'} ${deviceId}`,
            type: 'normal',
            click: () => {
                const win = global.deviceWindows.get(deviceId)
                if (win) {
                    if (win.isVisible()) {
                        win.hide()
                    } else {
                        win.show()
                    }
                    // Rebuild the tray menu after toggling
                    updateTrayMenu()
                }
            },
        }
    }) as Electron.MenuItemConstructorOptions[]

    const bottomMenuItems = [
        { type: 'separator' },
        {
            label: 'Settings',
            type: 'normal',
            click: () => {
                // Open settings window
                createSettingsWindow()
            },
        },
        {
            label: 'Quit',
            type: 'normal',
            click: () => {
                // Disconnect Companion client
                if (global.satelliteClient) {
                    global.satelliteClient.disconnect() // or .disconnect() based on your API
                }

                // Close all device windows
                global.deviceWindows?.forEach((win) => {
                    win.close()
                })

                // Destroy the tray
                if (tray) {
                    tray.destroy()
                }

                // Quit the app
                app.quit()

                setTimeout(() => {
                    console.log('Force exiting app...')
                    process.exit(0)
                }, 1000)
            },
        },
    ] as Electron.MenuItemConstructorOptions[]

    const contextMenu = Menu.buildFromTemplate([
        ...topMenuItems,
        ...deviceMenuItems,
        ...bottomMenuItems,
    ])

    if (tray) {
        tray?.setContextMenu(contextMenu)
    }
}

export { updateTrayMenu }
