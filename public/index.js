// Access the settings from Electron API
window.electronAPI.getSettings().then((settings) => {
    const { keysTotal, keysPerRow } = settings
    const keypad = document.getElementById('keypad')

    // Set the number of columns based on keysPerRow
    keypad.style.gridTemplateColumns = `repeat(${keysPerRow}, 1fr)`

    // Create the keys
    const keyElements = []
    for (let i = 1; i <= keysTotal; i++) {
        const key = document.createElement('div')
        key.className = 'key'
        const textSpan = document.createElement('span')
        textSpan.textContent = '' // Set the key text to empty
        key.appendChild(textSpan)

        // Handle key down (mouse or touch start)
        key.addEventListener('mousedown', () => sendKeyDown(i))
        key.addEventListener('touchstart', () => sendKeyDown(i), {
            passive: true,
        })

        // Handle key up (mouse or touch end)
        key.addEventListener('mouseup', () => sendKeyUp(i))
        //key.addEventListener('mouseleave', () => sendKeyUp(i)); // Handle case when mouse leaves the key
        key.addEventListener('touchend', () => sendKeyUp(i), { passive: true })

        keypad.appendChild(key)
        keyElements.push(key)
    }

    // Key queue to handle multiple key updates
    let keyQueue = []

    function addToKeyQueue(keyObj) {
        keyQueue.push(keyObj)
        //implement a queue so that we can process multiple key updates one at a time
        if (keyQueue.length === 1) {
            processKeyQueue()
        }
    }

    function processKeyQueue() {
        console.log('Processing key queue. Length:', keyQueue.length)
        if (keyQueue.length > 0) {
            const keyObj = keyQueue.shift()
            processKey(keyObj)
        }
    }

    function processKey(keyObj) {
        const { key, bitmap, color, textColor, text, fontSize } = keyObj
        const keyIndex = key

        // Check if the key index is valid
        if (keyIndex >= 0 && keyIndex < keysTotal) {
            const keyElement = keyElements[keyIndex]
            const textSpan = keyElement.querySelector('span')

            // Update the key image (bitmap)
            if (bitmap) {
                renderBitmap(keyElement, bitmap)
            } else {
                // Update the key background color
                if (color) {
                    keyElement.style.backgroundColor = color
                }

                // Decode base64 text and update the key text
                if (text) {
                    const decodedText = atob(text) // Decode the base64-encoded text
                    textSpan.textContent = decodedText
                }

                // Update the text color
                if (textColor) {
                    textSpan.style.color = textColor
                }

                // Update the font size
                if (fontSize) {
                    textSpan.style.fontSize = fontSize
                }
            }
        }

        processKeyQueue()
    }

    // Close button event listener
    document.getElementById('closeButton').addEventListener('click', () => {
        window.electronAPI.invoke('closeKeypad')
    })

    // Function to simulate button press based on the button index
    function pressButton(buttonIndex) {
        const button = document.querySelector(
            `.key[data-index="${buttonIndex}"]`
        )
        if (button) {
            // Trigger the button action
            button.click()
        }
    }

    // Listen for keyEvent from the main process
    window.electronAPI.onKeyEvent((event, keyObj) => {
        addToKeyQueue(keyObj)
    })

    // Listen for brightness adjustments
    window.electronAPI.onBrightness((event, brightness) => {
        adjustBrightness(brightness)
    })
})

// Function to adjust the brightness of all keys
function adjustBrightness(brightness) {
    // Adjust the opacity of the entire keypad
    const keypad = document.getElementById('keypad')
    keypad.style.opacity = brightness / 100
}

// Function to render 8-bit RGB bitmap data on a canvas
function renderBitmap(container, bitmap) {
    requestAnimationFrame(() => {
        const canvas =
            container.querySelector('canvas') ||
            document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        // Decode the base64 bitmap to binary data
        const binary = atob(bitmap)
        const bytes = new Uint8Array(binary.length)

        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i)
        }

        // Assuming the bitmap is a square; adjust if your data has a different width/height
        const size = Math.sqrt(bytes.length / 3) // Calculate the size assuming it's a square (3 bytes per pixel)

        canvas.width = size
        canvas.height = size

        const imageData = ctx.createImageData(size, size)

        // Fill the ImageData object with the RGB pixel data
        for (let i = 0, j = 0; i < bytes.length; i += 3, j += 4) {
            imageData.data[j] = bytes[i] // Red
            imageData.data[j + 1] = bytes[i + 1] // Green
            imageData.data[j + 2] = bytes[i + 2] // Blue
            imageData.data[j + 3] = 255 // Alpha (fully opaque)
        }

        // Draw the image on the canvas
        ctx.putImageData(imageData, 0, 0)

        // Append the canvas to the container (key element)
        if (!container.contains(canvas)) {
            container.innerHTML = '' // Clear existing content
            container.appendChild(canvas)
        }
    })
}

// Function to send keyDown event
function sendKeyDown(key) {
    window.electronAPI.invoke('keyDown', { key })
}

// Function to send keyUp event
function sendKeyUp(key) {
    window.electronAPI.invoke('keyUp', { key })
}
