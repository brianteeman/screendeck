declare global {
    var mainWindow: BrowserWindow | null
}

import { app, BrowserWindow, globalShortcut } from 'electron'
import createTray from './tray'
import { createMainWindow } from './mainWindow' // Import the createMainWindow function
import { createSatellite, closeSatellite } from './satelliteFunctions' // Import createSatellite and closeSatellite functions
import { showNotification } from './notification'
import { initializeIpcHandlers } from './ipcHandlers' // Import IPC handlers if needed

app.on('ready', () => {
    if (process.platform === 'darwin') {
        app.dock.hide()
    }

    createMainWindow()
    createTray()

    // Initialize IPC handlers after window creation
    initializeIpcHandlers()

    //wait 500ms before connecting to the satellite
    clearInterval(global.satelliteTimeout)
    global.satelliteTimeout = setTimeout(() => {
        createSatellite(true)
    }, 800)

    let quitTimeout: NodeJS.Timeout

    app.on('before-quit', (event) => {
        //event.preventDefault();
        closeSatellite() // Close the satellite connection when the app is quitting
        quitTimeout = setTimeout(() => {
            app.exit(0)
        }, 1000)
    })

    app.on('quit', () => clearTimeout(quitTimeout)) // Cleanup timeout on quit
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
    }
})
