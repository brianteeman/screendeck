import { contextBridge, ipcRenderer } from 'electron'

// Expose APIs to the renderer process through contextBridge
contextBridge.exposeInMainWorld('electronAPI', {
    // Wrapper for invoking IPC methods
    invoke: (channel: string, data?: any) => ipcRenderer.invoke(channel, data),
    send: (channel: string, data?: any) => ipcRenderer.send(channel, data),

    onShowDeviceLabel: (callback: any) =>
        ipcRenderer.on('showDeviceLabel', (_event, data) => callback(data)),

    // Listen for key events (per device)
    onKeyEvent: (callback: (event: any, keyObj: any) => void) => {
        ipcRenderer.on('keyEvent', (event, keyObj) => callback(event, keyObj))
    },

    // Listen for draw events
    onDraw: (callback: (event: any, data: any) => void) => {
        ipcRenderer.on('draw', (event, data) => callback(event, data))
    },

    // Listen for brightness changes
    onBrightness: (callback: (event: any, brightness: number) => void) => {
        ipcRenderer.on('brightness', (event, brightness) =>
            callback(event, brightness)
        )
    },

    // Listen for clearDeck events
    onClearDeck: (callback: (event: any) => void) => {
        ipcRenderer.on('clearDeck', callback)
    },

    // Listen for locked state changes
    onLockedState: (callback: (event: any, data: any) => void) => {
        ipcRenderer.on('lockedState', (event, data) => callback(event, data))
    },

    // Get per-device config (columnCount, rowCount, etc.)
    getDeviceConfig: (deviceId: string) =>
        ipcRenderer.invoke('get-device-config', deviceId),

    // Save settings (if you need it for settings page)
    saveSettings: (newSettings: any) =>
        ipcRenderer.invoke('saveSettings', newSettings),
})

console.log('Preload script loaded!')
