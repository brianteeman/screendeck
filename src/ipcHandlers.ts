import { ipcMain } from 'electron'
import Store from 'electron-store'
import { defaultSettings } from './defaults' // Import default settings
import { createMainWindow } from './mainWindow' // Import the createMainWindow function
import { createSatellite, closeSatellite } from './satelliteFunctions'

const store = new Store({ defaults: defaultSettings })

// Initialize the IPC handlers
export function initializeIpcHandlers() {
    // Handle reloading the main window
    ipcMain.handle('reloadWindow', () => {
        let keysTotal = store.get('keysTotal', 6)
        let keysPerRow = store.get('keysPerRow', 1)
        let bitmapSize = store.get('bitmapSize', 72)

        global.mainWindow?.hide()

        createMainWindow()

        let companionIP = store.get('companionIP', '127.0.0.1')
        let currentIP = global.satellite?.getIP()

        if (currentIP !== companionIP) {
            // If the IP address has changed
            closeSatellite()
            clearInterval(global.satelliteTimeout)
            global.satelliteTimeout = setTimeout(() => {
                createSatellite(false)
            }, 800)
        } else if (!global.satellite?.isConnected) {
            // If we are not connected
            clearInterval(global.satelliteTimeout)
            global.satelliteTimeout = setTimeout(() => {
                createSatellite(false)
            }, 800)
        } else {
            //wait 800ms before connecting to the satellite
            setTimeout(() => {
                global.satellite?.removeDevice()
                global.satellite?.changeKeys(keysTotal, keysPerRow, bitmapSize)
            }, 800)
        }
    })

    // Handle keyDown event from renderer or other sources
    ipcMain.handle('keyDown', (_, keyObj) => {
        if (satellite && typeof satellite.sendKeyDown === 'function') {
            let keyNumber: number = parseInt(keyObj.key) - 1
            satellite.sendKeyDown(keyNumber) // Call keyDown method on the Satellite instance
        }
    })

    // Handle keyUp event from renderer or other sources
    ipcMain.handle('keyUp', (_, keyObj) => {
        if (satellite && typeof satellite.sendKeyUp === 'function') {
            let keyNumber: number = parseInt(keyObj.key) - 1
            satellite.sendKeyUp(keyNumber)
        }
    })

    // Handle keyRotate event from renderer or other sources
    ipcMain.handle('keyRotate', (_, keyObj) => {
        if (satellite && typeof satellite.sendKeyRotate === 'function') {
            let keyNumber: number = parseInt(keyObj.key) - 1
            let direction: number = parseInt(keyObj.direction)
            satellite.sendKeyRotate(keyNumber, direction)
        }
    })

    // Handle setting the brightness
    ipcMain.handle('setBrightness', (_, brightness) => {
        if (global.mainWindow && global.mainWindow.webContents) {
            global.mainWindow.webContents.send('brightness', brightness)
        }
    })

    // Handle fetching settings
    ipcMain.handle('getSettings', () => {
        return store.store
    })

    // Handle saving settings
    ipcMain.handle('saveSettings', (_, newSettings) => {
        store.set(newSettings)
    })

    // Handle IPC request to close the keypad
    ipcMain.handle('closeKeypad', () => {
        global.mainWindow?.close()
    })
}
