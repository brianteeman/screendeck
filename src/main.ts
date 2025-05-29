import { app, BrowserWindow } from 'electron'
import type { CompanionSatelliteClient } from './client' // Your new client class
import { initializeIpcHandlers } from './ipcHandlers' // Import IPC handlers
import createTray from './tray' // Import the tray creation function

import {
    initializeDeviceIds,
    createDeviceWindows,
    createSatellite,
} from './utils' // Import utility functions

declare global {
    var satelliteClient: CompanionSatelliteClient | null
    var deviceWindows: Map<string, BrowserWindow>
}

global.deviceWindows = new Map()

// Initialize the Companion Satellite client and device windows
function init() {
    initializeDeviceIds() //ensure at least one deviceId exists
    initializeIpcHandlers() // Set up IPC handlers
    createDeviceWindows() // Create device windows
    createSatellite() // Initialize the Companion Satellite client
}

app.whenReady().then(() => {
    if (process.platform === 'darwin') {
        app.dock.hide() // Hide the dock icon on macOS
    }

    init() // Initialize the app, IPC handlers, and device windows
    createTray() // Create the system tray icon

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createDeviceWindows()
        }
    })

    app.on('window-all-closed', () => {
        //don't do anything unless closed by the tray
    })

    app.on('before-quit', () => {
        console.log('App is quitting...')
    })

    app.on('will-quit', () => {
        console.log('App will quit...')
    })

    app.on('quit', () => {
        console.log('App has quit.')
    })
})
