// src/types.d.ts

// Define the KeyObj type
export type KeyObj = {
    key?: number
    type?: string
    bitmap?: string
    color?: string
    textColor?: string
    text?: string
    fontSize?: string
}

export interface DeviceConfig {
    columnCount: number
    rowCount: number
    bitmapSize: number
    backgroundColor?: string
    backgroundOpacity?: string
    alwaysOnTop: boolean
    movable: boolean
    disablePress: boolean
    bounds?: Electron.Rectangle | null
}

export interface Profile {
    name: string
    deviceIds: string[]
    devices: Record<string, DeviceConfig>
}

export type ProfilesStore = Record<string, Profile>
