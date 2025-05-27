import { app, BrowserWindow, ipcMain, screen } from 'electron'
import Store from 'electron-store'
import ShortUniqueId from 'short-uuid'
import { defaultSettings } from './defaults' // Your settings file
import path from 'path'
import { CompanionSatelliteClient } from './client' // Your new client class
import { updateTrayMenu } from './tray'

const store = new Store({ defaults: defaultSettings })

// Create a window for each device
export function createDeviceWindow(deviceId: string) {
    console.log(`Creating window for deviceId: ${deviceId}`)

    //get properties by deviceId
    const columnCount = store.get(`device.${deviceId}.columnCount`, 8)
    const rowCount = store.get(`device.${deviceId}.rowCount`, 4)
    const bitmapSize = store.get(`device.${deviceId}.bitmapSize`, 72)
    const alwaysOnTop = store.get(`device.${deviceId}.alwaysOnTop`, true)
    const movable = store.get(`device.${deviceId}.movable`, false)
    const disablePress = store.get('disablePress', false)

    const { width, height } = calculateWindowSize(
        columnCount,
        rowCount,
        bitmapSize
    )
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth } = primaryDisplay.workAreaSize

    const win = new BrowserWindow({
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
        hasShadow: false,
        title: `ScreenDeck - ${deviceId}`,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true, // Enable context isolation for security
            nodeIntegration: false, // Disable nodeIntegration for security
        },
    })

    win.loadFile(path.join(__dirname, '../public/index.html'), {
        query: { deviceId },
    })

    //show devtools
    win.webContents.openDevTools({
        mode: 'detach', // Open in a separate window
    })

    //hide the window initially
    win.hide()

    // Handle window events
    win.on('focus', () => {
        win.webContents.send('windowFocused', { deviceId })
    })
    win.on('blur', () => {
        win.webContents.send('windowBlurred', { deviceId })
    })
    win.on('close', (event) => {
        event.preventDefault() // Prevent default close behavior
        win.hide() // Hide the window instead of closing it
        win.webContents.send('windowClosed', { deviceId })
    })
    win.on('show', () => {
        win.webContents.send('windowShown', { deviceId })
    })
    win.on('hide', () => {
        win.webContents.send('windowHidden', { deviceId })
    })

    global.deviceWindows.set(deviceId, win)
}

function showWindows() {
    // Show all device windows
    global.deviceWindows.forEach((win, deviceId) => {
        console.log(`Showing window for deviceId: ${deviceId}`)
        win.show()
        win.focus()
        win.webContents.send('windowShown', { deviceId })
    })
    console.log('All device windows shown')
}

// Initialize the deviceIds list (runs on first app launch)
export function initializeDeviceIds() {
    let deviceIds = store.get('deviceIds') as string[] | undefined

    if (!deviceIds || deviceIds.length === 0) {
        const newDeviceId = createNewDevice()
        store.set('deviceIds', [newDeviceId])
    }
}

export function createNewDevice(): string {
    const newDeviceId = generateDeviceId()

    // Also store default per-device settings
    store.set(`device.${newDeviceId}.columnCount`, 8)
    store.set(`device.${newDeviceId}.rowCount`, 4)
    store.set(`device.${newDeviceId}.bitmapSize`, 72)
    store.set(`device.${newDeviceId}.alwaysOnTop`, true)
    store.set(`device.${newDeviceId}.movable`, true)
    store.set(`device.${newDeviceId}.disablePress`, false)

    console.log(`Generated new deviceId: ${newDeviceId}`)

    return newDeviceId
}

// Generate a new unique deviceId
function generateDeviceId(): string {
    const uuidGenerator = ShortUniqueId()
    return `screendeck-${uuidGenerator.new()}`
}

export function calculateWindowSize(
    columnCount: number,
    rowCount: number,
    bitmapSize: number
) {
    const KEY_WIDTH = bitmapSize
    const KEY_HEIGHT = bitmapSize
    const PADDING = 20
    const GAP = 10
    const rows = rowCount
    const width =
        columnCount * KEY_WIDTH + (columnCount - 1) * GAP + PADDING * 2
    const height = rows * KEY_HEIGHT + (rows - 1) * GAP + PADDING * 2
    return { width, height }
}

export function createDeviceWindows() {
    const deviceIds = store.get('deviceIds') as string[] | undefined
    // Create windows for each device
    deviceIds?.forEach((deviceId) => {
        createDeviceWindow(deviceId)
    })
}

export function createSatellite() {
    // Create the CompanionSatelliteClient
    if (global.satelliteClient?.connected) {
        console.log('[Satellite] Already connected, skipping initialization')
        return
    }

    global.satelliteClient = new CompanionSatelliteClient({ debug: true })

    // Handle connection events
    global.satelliteClient.on('log', (msg) => console.log(`[Satellite] ${msg}`))
    global.satelliteClient.on('error', (err) =>
        console.error(`[Satellite Error] ${err}`)
    )

    global.satelliteClient.on('connected', () => {
        console.log('[Satellite] Connected')
        // Register devices
        const deviceIds = store.get('deviceIds') as string[] | []
        for (const deviceId of deviceIds) {
            console.log(`[Satellite] Adding device: ${deviceId}`)
            global.satelliteClient?.addDevice(deviceId, 'ScreenDeck', {
                columnCount: store.get(`device.${deviceId}.columnCount`, 8),
                rowCount: store.get(`device.${deviceId}.rowCount`, 4),
                bitmapSize: store.get(`device.${deviceId}.bitmapSize`, 72),
                colours: true,
                text: true,
                brightness: true,
                pincodeMap: null,
            })
        }

        updateTrayMenu()
        showWindows()
    })

    global.satelliteClient.on('draw', (data) => {
        /*console.log(`[Satellite] Draw event for device ${data.deviceId}`)
        console.log('[Satellite] Draw data:', data)*/

        const win = global.deviceWindows.get(data.deviceId)
        if (win) {
            win.webContents.send('draw', {
                ...data,
                image: data.image?.toString('base64') || undefined,
            })
        }
    })

    global.satelliteClient.on('clearDeck', (data) => {
        const win = global.deviceWindows.get(data.deviceId)
        if (win) {
            win.webContents.send('clearDeck')
        }
    })

    global.satelliteClient.on('brightness', (data) => {
        const win = global.deviceWindows.get(data.deviceId)
        if (win) {
            win.webContents.send('brightness', data.percent)
        }
    })

    global.satelliteClient.on('lockedState', (data) => {
        const win = global.deviceWindows.get(data.deviceId)
        if (win) {
            win.webContents.send('lockedState', data)
        }
    })

    // Connect to Companion
    global.satelliteClient
        .connect({
            mode: 'tcp',
            host: store.get('companionIP', '127.0.0.1') as string,
            port: store.get('companionPort', 16622) as number,
        })
        .catch((err) => {
            console.error(`[Satellite] Connection failed: ${err}`)
        })
}
