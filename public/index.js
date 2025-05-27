window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search)
    const deviceId = urlParams.get('deviceId')

    if (!deviceId) {
        console.error('No deviceId in query string')
        throw new Error('No deviceId')
    }

    let columnCount = 0
    let rowCount = 0
    let keysTotal = columnCount * rowCount
    let keyElements = []
    const activeKeys = new Set()

    // Request config from main process
    window.electronAPI.invoke('get-device-config', deviceId).then((config) => {
        columnCount = config.columnCount || 0
        rowCount = config.rowCount || 0

        if (columnCount <= 0 || rowCount <= 0) {
            console.warn(`No keys defined for ${deviceId}. Hiding UI.`)
            document.body.style.backgroundColor = 'transparent'
            document.getElementById('keypad').style.display = 'none'
            document.getElementById('closeButton').style.display = 'none'
            return
        }

        keysTotal = columnCount * rowCount
        keysPerRow = columnCount
        buildKeyGrid()
    })

    function buildKeyGrid() {
        const keypad = document.getElementById('keypad')
        keypad.style.gridTemplateColumns = `repeat(${columnCount}, 1fr)`

        keyElements = []

        for (let i = 0; i < keysTotal; i++) {
            const key = document.createElement('div')
            key.className = 'key'
            key.dataset.index = i

            const textSpan = document.createElement('span')
            key.appendChild(textSpan)

            key.addEventListener('mousedown', () => {
                activeKeys.add(i)
                sendKeyPress(i, 'down')
            })

            key.addEventListener('mouseup', () => {
                activeKeys.delete(i)
                sendKeyPress(i, 'up')
            })

            key.addEventListener(
                'touchstart',
                () => {
                    activeKeys.add(i)
                    sendKeyPress(i, 'down')
                },
                { passive: true }
            )

            key.addEventListener(
                'touchend',
                () => {
                    activeKeys.delete(i)
                    sendKeyPress(i, 'up')
                },
                { passive: true }
            )

            keypad.appendChild(key)
            keyElements.push(key)
        }
    }

    function sendKeyPress(keyIndex, action) {
        const x = keyIndex % columnCount
        const y = Math.floor(keyIndex / columnCount)

        window.electronAPI.send('keyPress', {
            deviceId,
            x,
            y,
            action,
        })
    }

    window.electronAPI.onShowDeviceLabel((data) => {
        const label = document.getElementById('device-label')
        if (label) {
            label.textContent = data.deviceId
            label.style.display = data.show ? 'block' : 'none'
        }
    })

    // Handle key events from Companion
    window.electronAPI.onDraw((event, keyObj) => {
        if (keyObj.deviceId !== deviceId) return
        processKey(keyObj)
    })

    // Handle brightness
    window.electronAPI.onBrightness((event, brightness) => {
        adjustBrightness(brightness)
    })

    // Close button
    document.getElementById('closeButton').addEventListener('click', () => {
        window.electronAPI.invoke('closeKeypad', deviceId) // Send deviceId so main process knows which to close
    })

    function processKey(keyObj) {
        console.log('Processing key:', keyObj)

        const keyIndex = keyObj.keyIndex
        const bitmap = keyObj.image
        const { color, textColor, text, fontSize } = keyObj

        if (keyIndex < 0 || keyIndex >= keyElements.length) {
            console.warn(
                'Skipping invalid key index:',
                keyIndex,
                'Total keys:',
                keyElements.length
            )
            return
        }

        const keyElement = keyElements[keyIndex]
        if (!keyElement) {
            console.warn('No keyElement found for key:', keyIndex)
            return
        }

        const textSpan = keyElement.querySelector('span')

        // If Companion sends a bitmap, render it
        if (bitmap) {
            renderBitmap(keyElement, bitmap)
            return
        }

        // Otherwise, update color/text if provided
        if (color) {
            keyElement.style.backgroundColor = color
        } else {
            // Clear color if not provided
            keyElement.style.backgroundColor = ''
        }

        if (textSpan) {
            if (text) {
                try {
                    textSpan.textContent = atob(text)
                } catch (err) {
                    console.warn('Invalid base64 text, using raw:', text)
                    textSpan.textContent = text
                }
            } else {
                textSpan.textContent = ''
            }

            if (textColor) {
                textSpan.style.color = textColor
            } else {
                textSpan.style.color = ''
            }

            if (fontSize) {
                textSpan.style.fontSize = fontSize
            } else {
                textSpan.style.fontSize = ''
            }
        }
    }

    // Brightness
    function adjustBrightness(brightness) {
        const keypad = document.getElementById('keypad')
        keypad.style.opacity = brightness / 100
    }

    // Bitmap Rendering
    function renderBitmap(container, bitmap) {
        requestAnimationFrame(() => {
            const canvas =
                container.querySelector('canvas') ||
                document.createElement('canvas')
            const ctx = canvas.getContext('2d')

            try {
                const binary = atob(bitmap)
                const bytes = new Uint8Array(binary.length)
                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i)
                }

                const size = Math.sqrt(bytes.length / 3)
                canvas.width = size
                canvas.height = size

                const imageData = ctx.createImageData(size, size)
                for (let i = 0, j = 0; i < bytes.length; i += 3, j += 4) {
                    imageData.data[j] = bytes[i]
                    imageData.data[j + 1] = bytes[i + 1]
                    imageData.data[j + 2] = bytes[i + 2]
                    imageData.data[j + 3] = 255
                }

                ctx.putImageData(imageData, 0, 0)
                if (!container.contains(canvas)) {
                    container.innerHTML = ''
                    container.appendChild(canvas)
                }
            } catch (err) {
                console.error('Error decoding bitmap:', err)
            }
        })
    }

    window.addEventListener('mouseup', () => {
        activeKeys.forEach((keyIndex) => {
            sendKeyPress(keyIndex, 'up')
        })
        activeKeys.clear()
    })

    window.addEventListener('blur', () => {
        activeKeys.forEach((keyIndex) => {
            sendKeyPress(keyIndex, 'up')
        })
        activeKeys.clear()
    })
})
