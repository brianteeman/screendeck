import { app, BrowserWindow, ipcMain, screen } from 'electron'
import Store from 'electron-store'
import ShortUniqueId from 'short-uuid'
import { defaultSettings } from './defaults' // Your settings file
import path from 'path'
import { CompanionSatelliteClient } from './client' // Your new client class
import { updateTrayMenu } from './tray'
import { ProfilesStore, Profile } from './types' // Import your types
import { showNotification } from './notification'
import { unregisterAllHotkeys, loadHotkeysFromStore } from './hotkeys' // Import hotkey management functions

const store = new Store({ defaults: defaultSettings })

const showDevTools =
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true' ||
    true

// Initialize the deviceIds list (runs on first app launch)
export function initializeDeviceIds() {
    let deviceIds = store.get('deviceIds') as string[] | undefined

    if (!deviceIds || deviceIds.length === 0) {
        const newDeviceId = createNewDevice()
        store.set('deviceIds', [newDeviceId])
    }
}

export function createDeviceWindows() {
    const deviceIds = store.get('deviceIds') as string[] | undefined
    // Create windows for each device
    deviceIds?.forEach((deviceId) => {
        createDeviceWindow(deviceId)
    })
}

// Create a window for each device
export function createDeviceWindow(deviceId: string) {
    console.log(`Creating window for deviceId: ${deviceId}`)

    //get properties by deviceId
    const columnCount = store.get(`device.${deviceId}.columnCount`, 8)
    const rowCount = store.get(`device.${deviceId}.rowCount`, 4)
    const bitmapSize = store.get(`device.${deviceId}.bitmapSize`, 72)
    const alwaysOnTop = store.get(`device.${deviceId}.alwaysOnTop`, true)
    const movable = store.get(`device.${deviceId}.movable`, false)
    const disablePress = store.get(`device.${deviceId}.disablePress`, false)
    const autoHide = store.get(`device.${deviceId}.autoHide`, false)
    const backgroundColor = store.get(
        `device.${deviceId}.backgroundColor`,
        '#000000'
    )
    const backgroundOpacity = store.get(
        `device.${deviceId}.backgroundOpacity`,
        0.5
    )

    const { width, height } = calculateWindowSize(
        columnCount,
        rowCount,
        bitmapSize
    )
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth } = primaryDisplay.workAreaSize

    // Restore position from store or use defaults
    const x = store.get(`device.${deviceId}.x`, screenWidth - width - 20)
    const y = store.get(`device.${deviceId}.y`, 20)

    const win = new BrowserWindow({
        width: width,
        height: height,
        x: x,
        y: y,
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

    win.webContents.on('did-finish-load', () => {
        win.webContents.send('updateBackground', {
            backgroundColor,
            backgroundOpacity,
        })

        win.webContents.send('disablePress', disablePress)
    })

    //show devtools
    if (showDevTools) {
        win.webContents.openDevTools({
            mode: 'detach', // Open in a separate window
        })
    }

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

    win.on('move', () => {
        const { x, y } = win.getBounds()
        store.set(`device.${deviceId}.x`, x)
        store.set(`device.${deviceId}.y`, y)
    })

    global.deviceWindows.set(deviceId, win)
}

function showWindows() {
    // Show all device windows
    global.deviceWindows.forEach((win, deviceId) => {
        console.log(`Showing window for deviceId: ${deviceId}`)
        const hidden = store.get(`device.${deviceId}.hidden`, false)
        if (!hidden) {
            win.show()
            win.focus()
            win.webContents.send('windowShown', { deviceId })
        } else {
            win.hide()
        }
    })
    console.log('All device windows shown')
}

export function showDeviceLabels(show: boolean) {
    global.deviceWindows.forEach((win, deviceId) => {
        win.webContents.send('showDeviceLabel', { deviceId, show })
    })
}

export function createNewDevice(): string {
    const newDeviceId = generateDeviceId()

    // Also store default per-device settings
    store.set(`device.${newDeviceId}.columnCount`, 8) // Default 8x4 layout
    store.set(`device.${newDeviceId}.rowCount`, 4) // Default 8x4 layout
    store.set(`device.${newDeviceId}.bitmapSize`, 72) // Default bitmap size
    store.set(`device.${newDeviceId}.alwaysOnTop`, true) // Default to true
    store.set(`device.${newDeviceId}.movable`, true) // Default to true
    store.set(`device.${newDeviceId}.disablePress`, false) // Default to false
    store.set(`device.${newDeviceId}.backgroundColor`, '#000000') // Default black
    store.set(`device.${newDeviceId}.backgroundOpacity`, 0.5) // Default semi-transparent

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

// ===========================
// Companion Satellite Client
// ===========================

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
        console.log('[Satellite] Connected Event Received')
        // Register devices
        setTimeout(() => {
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
        }, 500)
    })

    global.satelliteClient.on('draw', (data) => {
        /*console.log(`[Satellite] Draw event for device ${data.deviceId}`)
        console.log('[Satellite] Draw data:', data)*/

        //save the image to global.keyStates
        data.imageBase64 = data.image?.toString('base64') || undefined

        //save to global.keyStates
        if (!global.keyStates.has(data.deviceId)) {
            global.keyStates.set(data.deviceId, new Map())
        }

        // If this key is a registered hotkey, update its bitmap reference too
        for (const [hotkey, mapping] of global.registeredHotkeys.entries()) {
            if (
                mapping.deviceId === data.deviceId &&
                mapping.keyIndex === data.keyIndex
            ) {
                // Update the bitmap for this hotkey (optional redundancy)
                mapping.imageBase64 = data.imageBase64 ?? ''
            }
        }

        const deviceKeyStates = global.keyStates.get(data.deviceId)
        if (deviceKeyStates) {
            deviceKeyStates.set(data.keyIndex, {
                imageBase64: data.imageBase64,
                color: data.color,
                text: data.text,
            })
        }

        // Send the draw event to the corresponding device window
        const win = global.deviceWindows.get(data.deviceId)
        if (win) {
            win.webContents.send('draw', data)
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

// ===========================
// Profile Management
// ===========================

function generateProfileId() {
    const uuidGenerator = ShortUniqueId()
    return `profile-${uuidGenerator.new()}`
}

export function promptForProfileName(): Promise<string | undefined> {
    return new Promise((resolve) => {
        const promptWindow = new BrowserWindow({
            width: 500,
            height: 200,
            resizable: false,
            minimizable: false,
            maximizable: false,
            modal: true,
            show: false,
            parent: BrowserWindow.getFocusedWindow() || undefined,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
            },
        })

        //show dev tools
        if (showDevTools) {
            promptWindow.webContents.openDevTools({
                mode: 'detach', // Open in a separate window
            })
        }

        // Load the HTML file for the input dialog
        promptWindow.loadFile(
            path.join(__dirname, '../public/profilePrompt.html')
        )

        promptWindow.once('ready-to-show', () => {
            promptWindow.show()
        })

        // Listen for the input from the renderer
        ipcMain.once('profileNameResult', (_event, result) => {
            resolve(result)
            promptWindow.close()
        })

        promptWindow.on('closed', () => {
            resolve(undefined)
        })
    })
}

export function getNextProfileName() {
    const existingProfiles = store.get('profiles', {}) as ProfilesStore // object of profiles
    let maxNumber = 0

    Object.values(existingProfiles).forEach((profile) => {
        const match = profile.name?.match(/^Profile (\d+)$/)
        if (match) {
            const num = parseInt(match[1])
            if (num > maxNumber) maxNumber = num
        }
    })

    return `Profile ${maxNumber + 1}`
}

export function saveProfile(profileName: string) {
    const profileId = generateProfileId()

    const profiles: ProfilesStore = store.get('profiles', {})
    const newProfile: Profile = {
        name: profileName,
        deviceIds: store.get('deviceIds', []),
        devices: store.get('device', {}),
    }
    profiles[profileId] = newProfile
    store.set('profiles', profiles)

    console.log(`Profile "${profileName}" saved as ${profileId}.`)
    showNotification(
        'Profile Saved',
        `Profile "${profileName}" has been saved successfully.`
    )

    updateTrayMenu()
}

export function loadProfile(profileId: string) {
    const profiles = store.get('profiles', {}) as ProfilesStore
    const profile = profiles[profileId]

    if (!profile) return

    const profileName = profile.name

    console.log(`Loading profile "${profileName}" with ID ${profileId}`)
    console.log('Profile details:', profile)

    // Close all current windows
    global.deviceWindows.forEach((win) => win.close())
    global.deviceWindows.clear()

    // Remove all current devices from satellite
    if (global.satelliteClient) {
        const currentDeviceIds = store.get('deviceIds', []) as string[]
        for (const deviceId of currentDeviceIds) {
            console.log(`[Satellite] Removing device: ${deviceId}`)
            global.satelliteClient.removeDevice(deviceId)
        }
    }

    // Remove all 'device.<deviceId>.' keys from store
    const currentDeviceIds = store.get('deviceIds', []) as string[]
    for (const deviceId of currentDeviceIds) {
        const keysToRemove = Object.keys(store.store).filter((key) =>
            key.startsWith(`device.${deviceId}.`)
        )
        for (const key of keysToRemove) {
            store.delete(key as any)
        }
    }

    //unregister all hotkeys for devices
    unregisterAllHotkeys()

    // Set deviceIds and restore device configs from profile
    store.set('deviceIds', profile.deviceIds)

    for (const deviceId of profile.deviceIds) {
        const deviceConfig = profile.devices[deviceId]
        if (deviceConfig) {
            Object.entries(deviceConfig).forEach(([key, value]) => {
                store.set(`device.${deviceId}.${key}`, value)
            })
        }
    }

    // Recreate device windows
    createDeviceWindows()
    const deviceIds = store.get('deviceIds', []) as string[]
    console.log(`Recreating windows for devices: ${deviceIds.join(', ')}`)
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

    showWindows()

    //register hotkeys for the new devices
    loadHotkeysFromStore()

    console.log(`Profile "${profileName}" loaded.`)

    showNotification(
        'Profile Loaded',
        `Profile "${profileName}" has been loaded successfully.`
    )

    store.set('currentProfile', profileId)

    updateTrayMenu()
}

export function deleteProfile(profileId: string) {
    const profiles = store.get('profiles', {}) as ProfilesStore
    const profile = profiles[profileId]
    if (!profile) return
    const profileName = profiles[profileId]?.name
    delete profiles[profileId]
    store.set('profiles', profiles)
    console.log(`Profile "${profileName}" deleted.`)
    showNotification(
        'Profile Deleted',
        `Profile "${profileName}" has been deleted successfully.`
    )
    updateTrayMenu()
}
