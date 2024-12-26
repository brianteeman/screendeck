// src/defaults.ts

export const defaultSettings = {
    companionIP: '127.0.0.1', // Default IP address for companion
    companionPort: 16622, // Default satellite port for companion
    keysTotal: 6, // Default total keys for companion
    keysPerRow: 1, // Default keys per row for companion
    bitmapSize: 72, // Default bitmap size
    alwaysOnTop: true, // Default always on top setting
    movable: false, // Default setting for whether the window is movable
	disablePress: false, // Default setting for whether button presses are allowed or not
}

export type SettingsType = typeof defaultSettings
