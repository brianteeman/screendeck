import { ipcMain } from 'electron'
import Store from 'electron-store'
import { defaultSettings } from './defaults'
import {
    createNewDevice,
    createDeviceWindow,
    createSatellite,
    calculateWindowSize,
} from './utils' // Import your window creation function
import { updateTrayMenu } from './tray'

const store = new Store({ defaults: defaultSettings })

export function initializeIpcHandlers() {
    ipcMain.handle('get-device-config', (_event, deviceId) => {
        const columnCount = store.get(`device.${deviceId}.columnCount`, 8)
        const rowCount = store.get(`device.${deviceId}.rowCount`, 4)
        const bitmapSize = store.get(`device.${deviceId}.bitmapSize`, 72)
        const alwaysOnTop = store.get(`device.${deviceId}.alwaysOnTop`, false)
        const movable = store.get(`device.${deviceId}.movable`, true)
        const disablePress = store.get(`device.${deviceId}.disablePress`, false)

        return {
            columnCount,
            rowCount,
            bitmapSize,
            alwaysOnTop,
            movable,
            disablePress,
        }
    })

    ipcMain.handle('closeKeypad', (_event, deviceId) => {
        const win = global.deviceWindows.get(deviceId)
        if (win) {
            win.hide()
        }

        updateTrayMenu()
    })

    // Handle keyPress events (from renderer)
    ipcMain.on('keyPress', (_event, { deviceId, x, y, action }) => {
        if (!global.satelliteClient) return

        const disablePress = store.get(`device.${deviceId}.disablePress`, false)
        if (disablePress) {
            console.log(`Button presses disabled for ${deviceId}. Ignoring.`)
            return
        }

        if (action === 'down') {
            global.satelliteClient.keyDownXY(deviceId, x, y)
        } else if (action === 'up') {
            global.satelliteClient.keyUpXY(deviceId, x, y)
        } else if (action === 'rotateLeft') {
            global.satelliteClient.rotateLeftXY(deviceId, x, y)
        } else if (action === 'rotateRight') {
            global.satelliteClient.rotateRightXY(deviceId, x, y)
        }
    })

    // Handle brightness request from renderer (optional)
    ipcMain.handle('setBrightness', (_event, brightness) => {
        global.deviceWindows?.forEach((win) => {
            win.webContents.send('brightness', brightness)
        })
    })

    ipcMain.handle('createNewDevice', () => {
        const newDeviceId = createNewDevice()

        let deviceIds = store.get('deviceIds', []) as string[]
        deviceIds.push(newDeviceId)
        store.set('deviceIds', deviceIds)

        // Create the window
        createDeviceWindow(newDeviceId)

        return newDeviceId
    })

    ipcMain.handle('getAllDevices', () => {
        const deviceIds = store.get('deviceIds', []) as string[]
        return deviceIds.map((id) => ({
            deviceId: id,
            columnCount: store.get(`device.${id}.columnCount`, 8),
            rowCount: store.get(`device.${id}.rowCount`, 4),
            bitmapSize: store.get(`device.${id}.bitmapSize`, 72),
            alwaysOnTop: store.get(`device.${id}.alwaysOnTop`, false),
            movable: store.get(`device.${id}.movable`, true),
            disablePress: store.get(`device.${id}.disablePress`, false),
        }))
    })

    ipcMain.handle('updateDeviceConfig', (_event, { deviceId, config }) => {
        Object.entries(config).forEach(([key, value]) => {
            store.set(`device.${deviceId}.${key}`, value)
        })

        // If the Satellite client is connected, update the device config
        if (global.satelliteClient) {
            //delete the device first to ensure it gets re-registered with the new config
            global.satelliteClient.removeDevice(deviceId)
            global.satelliteClient.addDevice(deviceId, 'ScreenDeck', {
                columnCount: store.get(`device.${deviceId}.columnCount`, 8),
                rowCount: store.get(`device.${deviceId}.rowCount`, 4),
                bitmapSize: store.get(`device.${deviceId}.bitmapSize`, 72),
                colours: true,
                text: true,
                brightness: true,
                pincodeMap: null,
            })
        }
        console.log(`Device ${deviceId} config updated:`, config)

        // Also update the BrowserWindow properties
        const win = global.deviceWindows.get(deviceId)
        if (win) {
            if (config.alwaysOnTop !== undefined) {
                win.setAlwaysOnTop(Boolean(config.alwaysOnTop))
            }
            if (config.movable !== undefined) {
                win.setMovable(Boolean(config.movable))
            }

            // Resize window if columnCount/rowCount/bitmapSize changed
            if (
                config.columnCount !== undefined ||
                config.rowCount !== undefined ||
                config.bitmapSize !== undefined
            ) {
                const columnCount = store.get(
                    `device.${deviceId}.columnCount`,
                    8
                )
                const rowCount = store.get(`device.${deviceId}.rowCount`, 4)
                const bitmapSize = store.get(
                    `device.${deviceId}.bitmapSize`,
                    72
                )

                const { width, height } = calculateWindowSize(
                    columnCount,
                    rowCount,
                    bitmapSize
                )

                win.setSize(width, height)
            }
        }

        win?.show()

        // Update the tray menu to reflect changes
        updateTrayMenu()
    })

    ipcMain.handle('deleteDevice', (_event, deviceId) => {
        let deviceIds = store.get('deviceIds', []) as string[]
        deviceIds = deviceIds.filter((id) => id !== deviceId)
        store.set('deviceIds', deviceIds)

        // Remove all device-specific settings
        const keys = Object.keys(store.store)
        keys.forEach((key) => {
            if (key.startsWith(`device.${deviceId}.`)) {
                store.delete(key as any)
            }
        })

        // Close the window
        const win = global.deviceWindows.get(deviceId)
        if (win) {
            win.close()
            global.deviceWindows.delete(deviceId)
        }

        // If the Satellite client is connected, remove the device
        if (global.satelliteClient) {
            global.satelliteClient.removeDevice(deviceId)
        }
        console.log(`Device ${deviceId} deleted.`)
    })

    ipcMain.handle('getSettings', () => {
        return store.store
    })

    // Handle saving settings
    ipcMain.handle('saveSettings', (_event, newSettings) => {
        const previousIP = store.get('companionIP', '127.0.0.1')
        const previousPort = store.get('companionPort', 16622)

        store.set(newSettings)

        const newIP = newSettings.companionIP
        const newPort = newSettings.companionPort

        if (newIP !== previousIP || newPort !== previousPort) {
            console.log(
                'Companion IP or port changed, restarting connection...'
            )

            if (global.satelliteClient) {
                global.satelliteClient.disconnect() // Your close method for the new API
                global.satelliteClient = null
            }

            // Wait briefly, then reconnect with the new IP/port
            setTimeout(() => {
                createSatellite() // Your function to initialize the Satellite client
            }, 500)
        }
    })
}
