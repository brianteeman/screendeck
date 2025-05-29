// Helper function to convert hex + opacity to rgba
function hexToRgba(hex, opacity) {
    if (!hex) return `rgba(0,0,0,${opacity})`
    const bigint = parseInt(hex.replace('#', ''), 16)
    const r = (bigint >> 16) & 255
    const g = (bigint >> 8) & 255
    const b = bigint & 255
    return `rgba(${r},${g},${b},${opacity})`
}

window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search)
    const deviceId = urlParams.get('deviceId')

    if (!deviceId) {
        console.error('No deviceId in query string')
        throw new Error('No deviceId')
    }

    let keyElements = []
    const activeKeys = new Set()

    globalColumnCount = 0

    let initialBackground = null
    let initialOpacity = null

    // Request config from main process
    window.electronAPI.invoke('get-device-config', deviceId).then((config) => {
        const { backgroundColor, backgroundOpacity } = config

        const keypad = document.getElementById('keypad')
        if (keypad) {
            keypad.style.backgroundColor = hexToRgba(
                backgroundColor,
                backgroundOpacity
            )
        }

        const columnCount = config.columnCount || 0
        globalColumnCount = columnCount
        const rowCount = config.rowCount || 0

        if (columnCount <= 0 || rowCount <= 0) {
            console.warn(`No keys defined for ${deviceId}. Hiding UI.`)
            document.body.style.backgroundColor = 'transparent'
            document.getElementById('keypad').style.display = 'none'
            document.getElementById('closeButton').style.display = 'none'
            return
        }

        buildKeyGrid(columnCount, rowCount)
    })

    function buildKeyGrid(columnCount, rowCount) {
        const keypad = document.getElementById('keypad')
        keypad.style.gridTemplateColumns = `repeat(${columnCount}, 1fr)`

        // Remove only existing keys
        keypad.querySelectorAll('.key').forEach((key) => key.remove())

        keyElements = []

        keysTotal = columnCount * rowCount

        for (let i = 0; i < keysTotal; i++) {
            const key = document.createElement('div')
            key.className = 'key'
            key.dataset.index = i

            const textSpan = document.createElement('span')
            key.appendChild(textSpan)

            key.addEventListener('mousedown', (e) => {
                if (e.button === 2) {
                    // Right-click: ignore
                    return
                }

                window.electronAPI
                    .invoke('getKeyConfig', {
                        deviceId,
                        keyIndex: i,
                    })
                    .then((keyConfig) => {
                        const isEncoder = keyConfig.isEncoder
                        const stepSize = keyConfig.stepSize || 10

                        if (isEncoder) {
                            e.preventDefault()

                            let accumulatedDeltaX = 0
                            let lastX = e.clientX

                            const onMove = (moveEvent) => {
                                const deltaX = moveEvent.clientX - lastX
                                accumulatedDeltaX += deltaX

                                while (
                                    Math.abs(accumulatedDeltaX) >= stepSize
                                ) {
                                    const direction =
                                        accumulatedDeltaX > 0
                                            ? 'rotateRight'
                                            : 'rotateLeft'

                                    sendKeyPress(i, direction)

                                    // Subtract the step in the direction we just sent
                                    if (accumulatedDeltaX > 0) {
                                        accumulatedDeltaX -= stepSize
                                    } else {
                                        accumulatedDeltaX += stepSize
                                    }
                                }

                                lastX = moveEvent.clientX
                            }

                            const onUp = () => {
                                window.removeEventListener('mousemove', onMove)
                                window.removeEventListener('mouseup', onUp)
                            }

                            window.addEventListener('mousemove', onMove)
                            window.addEventListener('mouseup', onUp)
                        } else {
                            activeKeys.add(i)
                            sendKeyPress(i, 'down')
                        }
                    })
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

            key.addEventListener('contextmenu', (e) => {
                e.preventDefault()

                window.electronAPI
                    .invoke('toggleEncoder', { deviceId, keyIndex: i })
                    .then((newIsEncoder) => {
                        key.classList.toggle('encoder', newIsEncoder)
                    })
            })

            keypad.appendChild(key)
            keyElements.push(key)
        }
    }

    function sendKeyPress(keyIndex, action) {
        const x = keyIndex % globalColumnCount
        const y = Math.floor(keyIndex / globalColumnCount)

        sendKeyPressXY(x, y, action)
    }

    function sendKeyPressXY(x, y, action) {
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

    window.electronAPI.onDisablePress((_, disabled) => {
        const keypad = document.getElementById('keypad')
        const lock = document.getElementById('lockIndicator')

        if (keypad && lock) {
            keypad.classList.toggle('disabled', disabled)
            lock.style.display = disabled ? 'block' : 'none'
        }
    })

    window.electronAPI.onIdentify(() => {
        const keypad = document.getElementById('keypad')
        if (!keypad) return

        // Apply flash - yellow in rgba
        keypad.style.backgroundColor = 'rgba(255, 255, 0, 1)'
        //add transition for smooth effect
        keypad.style.transition = 'background-color 0.5s ease'

        setTimeout(() => {
            window.electronAPI
                .invoke('get-device-config', deviceId)
                .then((config) => {
                    console.log('got config:', config)
                    const { backgroundColor, backgroundOpacity } = config

                    const keypad = document.getElementById('keypad')
                    if (keypad) {
                        keypad.style.backgroundColor = hexToRgba(
                            backgroundColor,
                            backgroundOpacity
                        )
                    }
                })
        }, 800)
    })

    window.electronAPI.onUpdateBackground((_, data) => {
        console.log('Updating background:', data)
        const keypad = document.getElementById('keypad')
        keypad.style.backgroundColor = hexToRgba(
            data.backgroundColor,
            data.backgroundOpacity
        )
    })

    window.electronAPI.onRebuildGrid((_, { columnCount, rowCount }) => {
        globalColumnCount = columnCount
        buildKeyGrid(columnCount, rowCount)
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
