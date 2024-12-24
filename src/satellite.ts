import { EventEmitter } from 'events'
import net, { Socket } from 'net'

export interface KeyEvent {
    deviceId?: string
    key?: number
    type?: string
    bitmap?: string
    color?: string
    textColor?: string
    text?: string
    fontSize?: string
}

export class Satellite extends EventEmitter {
    private deviceId: string
    private productName: string
    private ip: string
    private port: number
    private keysTotal: number
    private keysPerRow: number
    private bitmaps: boolean | string | number
    private colors: boolean | string
    private text: boolean
    private textStyle: boolean
    private socket: Socket | null
    private ping_interval: NodeJS.Timeout | null

    public companionVersion: string | null
    public apiVersion: string | null

    constructor(
        deviceId = '11111',
        productName = 'ScreenDeck',
        ip = '127.0.0.1',
        port = 16622,
        keysTotal = 6,
        keysPerRow = 1,
        bitmaps: boolean | string | number = true,
        colors: boolean | string = true,
        text = true,
        textStyle = true
    ) {
        super()

        this.deviceId = deviceId
        this.productName = productName
        this.ip = ip
        this.port = port
        this.keysTotal = keysTotal
        this.keysPerRow = keysPerRow
        this.bitmaps = bitmaps
        this.colors = colors
        this.text = text
        this.textStyle = textStyle
        this.socket = null
        this.ping_interval = null

        this.companionVersion = ''
        this.apiVersion = ''
    }

    public isConnected = false

    public getIP() {
        return this.ip
    }

    public connect() {
        this.companionVersion = ''
        this.apiVersion = ''

        this.socket = new net.Socket()

        this.socket.connect(this.port, this.ip, () => {})

        let receiveBuffer = ''

        this.socket.on('data', (chunk) => {
            receiveBuffer += chunk.toString()

            let lineEnd
            while ((lineEnd = receiveBuffer.indexOf('\n')) !== -1) {
                const line = receiveBuffer.slice(0, lineEnd).trim() // Extract and trim the line
                receiveBuffer = receiveBuffer.slice(lineEnd + 1) // Update the buffer
                try {
                    this.processData(line) // Process the line
                } catch (error) {
                    console.error(error)
                }
            }
        })

        this.socket.on('error', (error) => {
            this.emit('error', error)
            //this.disconnect();
        })
    }

    public disconnect() {
        if (this.ping_interval) {
            clearInterval(this.ping_interval)
        }

        this.removeDevice()
        this.sendCommand('QUIT')

        if (this.socket) {
            this.socket.destroy()
            this.socket = null
        }

        this.emit('disconnected')
    }

    public changeKeys(
        keysTotal: number,
        keysPerRow: number,
        bitmaps: boolean | string | number
    ) {
        this.keysTotal = keysTotal
        this.keysPerRow = keysPerRow
        this.bitmaps = bitmaps
        this.addDevice()
    }

    public addDevice() {
        if (this.apiVersion === null) {
            this.apiVersion = '1.0.0'
        }

        const [major, minor, patch] = this.apiVersion.split('.').map(Number)

        let addDeviceCmd = `ADD-DEVICE DEVICEID=${this.deviceId} PRODUCT_NAME="${this.productName}"`

        if (
            major >= 1 ||
            (major === 1 && minor >= 5) ||
            (major === 1 && minor === 5 && patch >= 1)
        ) {
            addDeviceCmd += ` KEYS_TOTAL=${this.keysTotal} KEYS_PER_ROW=${this.keysPerRow}`
        }

        if (major >= 1 || (major === 1 && minor >= 5)) {
            //verify if bitmaps is a number
            if (typeof this.bitmaps === 'number') {
                addDeviceCmd += ` BITMAPS=${this.bitmaps}`
            } else {
                if (this.bitmaps !== true && this.bitmaps !== false) {
                    this.bitmaps = true
                }
                addDeviceCmd += ` BITMAPS=${this.bitmaps}`
            }
        } else {
            if (this.bitmaps !== true && this.bitmaps !== false) {
                this.bitmaps = true
            }
            addDeviceCmd += ` BITMAPS=${this.bitmaps}`
        }

        if (major >= 1 || (major === 1 && minor >= 6)) {
            addDeviceCmd += ` COLORS=${this.colors}`
        } else {
            if (this.colors !== true && this.colors !== false) {
                this.colors = true
            }
            addDeviceCmd += ` COLORS=${this.colors}`
        }

        addDeviceCmd += ` TEXT=${this.text}`

        if (major >= 1 || (major === 1 && minor >= 4)) {
            addDeviceCmd += ` TEXT_STYLE=${this.textStyle}`
        }

        this.sendCommand(addDeviceCmd)
        console.log('Device Added:', addDeviceCmd)
    }

    public removeDevice() {
        this.sendCommand(`REMOVE-DEVICE DEVICEID=${this.deviceId}`)
    }

    private startPing() {
        this.ping_interval = setInterval(() => {
            this.sendCommand('PING')
        }, 2000) // 2 seconds, as recommended per the protocol
    }

    private sendCommand(cmd: string) {
        if (this.socket) {
            this.socket.write(`${cmd}\n`)
        }
    }

    public close() {
        this.disconnect()
    }

    public sendKeyDown(keyNumber: number) {
        //ensure key is a number between 0 and total keys
        if (keyNumber < 0 || keyNumber >= this.keysTotal) {
            this.emit('error', 'Invalid key number')
        }

        this.sendCommand(
            `KEY-PRESS DEVICEID=${this.deviceId} KEY=${keyNumber} PRESSED=true`
        )
    }

    public sendKeyUp(keyNumber: number) {
        //ensure key is a number between 0 and total keys
        if (keyNumber < 0 || keyNumber >= this.keysTotal) {
            this.emit('error', 'Invalid key number')
        }

        this.sendCommand(
            `KEY-PRESS DEVICEID=${this.deviceId} KEY=${keyNumber} PRESSED=false`
        )
    }

    public sendKeyRotate(keyNumber: number, direction: number) {
        //ensure direction is -1 or 1
        if (direction !== -1 && direction !== 1) {
            direction = 1
        }

        this.sendCommand(
            `ROTATE DEVICEID=${this.deviceId} KEY=${keyNumber} DIRECTION=${direction}`
        )
    }

    private processData(data: string) {
        try {
            const str_raw = data.trim()
            const str_split = str_raw.split('\n')

            for (const str of str_split) {
                const params = str.split(' ')
                const command = params[0]

                if (command === 'BEGIN') {
                    this.isConnected = true
                    this.emit('connected')

                    for (let i = 1; i < params.length; i++) {
                        const [property, value] = params[i].split('=')

                        if (property.toUpperCase() === 'COMPANIONVERSION') {
                            this.companionVersion = value
                            console.log(
                                'Companion Version:',
                                this.companionVersion
                            )
                        }

                        if (property.toUpperCase() === 'APIVERSION') {
                            this.apiVersion = value
                            console.log('API Version:', this.apiVersion)
                        }
                    }

                    if (!this.apiVersion) {
                        this.apiVersion = '1.0.0'
                    }

                    this.addDevice()
                    continue
                }

                if (command === 'ADD-DEVICE') {
                    if (params[1] === 'OK') {
                        this.startPing()
                    }
                    continue
                }

                if (command === 'KEY-STATE') {
                    const keyObj: KeyEvent = {}

                    for (let i = 1; i < params.length; i++) {
                        const [property, value] = params[i].split('=')

                        switch (property) {
                            case 'DEVICEID':
                                keyObj.deviceId = value
                                break
                            case 'KEY':
                                keyObj.key = parseInt(value, 10)
                                break
                            case 'TYPE':
                                keyObj.type = value
                                break
                            case 'BITMAP':
                                keyObj.bitmap = value
                                break
                            case 'COLOR':
                                keyObj.color = value
                                break
                            case 'TEXT_COLOR':
                                keyObj.textColor = value
                                break
                            case 'TEXT':
                                keyObj.text = value
                                break
                            case 'FONT_SIZE':
                                keyObj.fontSize = value
                                break
                        }
                    }

                    this.emit('keyEvent', keyObj)
                }

                if (command === 'KEYS-CLEAR') {
                    // Handle KEYS-CLEAR logic
                    this.emit('clear')
                }

                if (command === 'BRIGHTNESS') {
                    // Handle BRIGHTNESS logic
                    for (let i = 1; i < params.length; i++) {
                        const [property, value] = params[i].split('=') // Split the property and value

                        if (property === 'VALUE') {
                            this.emit('brightness', parseInt(value, 10)) // Emit the brightness event
                        }
                    }
                }
            }
        } catch (error) {
            console.error(error)
        }
    }
}
