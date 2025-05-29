window.addEventListener('DOMContentLoaded', () => {
    const deviceList = document.getElementById('deviceList')
    const addDeviceButton = document.getElementById('addDevice')

    loadCompanionSettings()
    loadDevices()

    document
        .getElementById('saveCompanion')
        .addEventListener('click', async () => {
            const ip = document.getElementById('companionIP').value
            const port = parseInt(
                document.getElementById('companionPort').value,
                10
            )

            await window.electronAPI.invoke('saveSettings', {
                companionIP: ip,
                companionPort: port,
            })

            alert('Companion settings saved! Restart the app to apply changes.')
        })

    async function loadCompanionSettings() {
        const settings = await window.electronAPI.invoke('getSettings')

        document.getElementById('companionIP').value =
            settings.companionIP || '127.0.0.1'
        document.getElementById('companionPort').value =
            settings.companionPort || 16622
    }

    async function loadDevices() {
        const devices = await window.electronAPI.invoke('getAllDevices')
        deviceList.innerHTML = ''

        devices.forEach((device) => {
            const container = document.createElement('div')
            container.classList.add('device')

            const idLabel = document.createElement('strong')
            idLabel.textContent = device.deviceId
            container.appendChild(idLabel)

            // Editable fields
            const columnCountInput = createInput('Columns', device.columnCount)
            const rowCountInput = createInput('Rows', device.rowCount)
            const bitmapSizeInput = createInput('Bitmap', device.bitmapSize)
            const alwaysOnTopInput = createCheckbox(
                'Always On Top',
                device.alwaysOnTop
            )
            const movableInput = createCheckbox('Movable', device.movable)
            const disablePressInput = createCheckbox(
                'Disable Button Presses',
                device.disablePress
            )

            // Create color picker
            const backgroundColorInput = document.createElement('input')
            backgroundColorInput.type = 'color'
            backgroundColorInput.value = device.backgroundColor || '#000000'

            const backgroundOpacityInput = document.createElement('input')
            backgroundOpacityInput.type = 'range'
            backgroundOpacityInput.min = 0
            backgroundOpacityInput.max = 1
            backgroundOpacityInput.step = 0.01
            backgroundOpacityInput.value = device.backgroundOpacity || 0.5

            const backgroundColorLabel = document.createElement('label')
            backgroundColorLabel.textContent = 'Background Color: '
            backgroundColorLabel.appendChild(backgroundColorInput)

            const backgroundOpacityLabel = document.createElement('label')
            backgroundOpacityLabel.textContent = 'Background Opacity: '
            backgroundOpacityLabel.appendChild(backgroundOpacityInput)

            /*backgroundColorInput.addEventListener('input', async () => {
                await window.electronAPI.invoke('updateDeviceConfig', {
                    deviceId: device.deviceId,
                    config: { backgroundColor: backgroundColorInput.value },
                })
            })*/

            backgroundOpacityInput.addEventListener('input', async () => {
                await window.electronAPI.invoke('updateDeviceConfig', {
                    deviceId: device.deviceId,
                    config: {
                        backgroundOpacity: parseFloat(
                            backgroundOpacityInput.value
                        ),
                    },
                })
            })

            container.appendChild(document.createElement('hr'))

            const inputs = [
                columnCountInput,
                rowCountInput,
                bitmapSizeInput,
                alwaysOnTopInput,
                movableInput,
                disablePressInput,
            ]

            inputs.forEach((inputObj) => {
                container.appendChild(inputObj.label)
                container.appendChild(inputObj.input)
            })

            container.appendChild(backgroundColorLabel)
            container.appendChild(backgroundOpacityLabel)

            // Save & Delete buttons
            const actions = document.createElement('div')
            actions.classList.add('device-actions')

            const saveBtn = document.createElement('button')
            saveBtn.textContent = 'Save'
            saveBtn.addEventListener('click', async () => {
                const config = {
                    columnCount: parseInt(columnCountInput.input.value, 10),
                    rowCount: parseInt(rowCountInput.input.value, 10),
                    bitmapSize: parseInt(bitmapSizeInput.input.value),
                    alwaysOnTop: alwaysOnTopInput.input.checked,
                    movable: movableInput.input.checked,
                    disablePress: disablePressInput.input.checked,
                    backgroundColor: backgroundColorInput.value,
                    backgroundOpacity: parseFloat(backgroundOpacityInput.value),
                }
                await window.electronAPI.invoke('updateDeviceConfig', {
                    deviceId: device.deviceId,
                    config,
                })
                if (!container.querySelector('.save-confirmation')) {
                    const confirmation = document.createElement('span')
                    confirmation.className = 'save-confirmation'
                    confirmation.textContent = 'Settings saved!'
                    confirmation.style.marginLeft = '10px'
                    confirmation.style.fontSize = '12px'
                    confirmation.style.color = '#4CAF50'
                    confirmation.style.opacity = '0'
                    confirmation.style.transition = 'opacity 0.3s ease'

                    actions.appendChild(confirmation)

                    setTimeout(() => {
                        confirmation.style.opacity = '1'
                    }, 10)

                    setTimeout(() => {
                        confirmation.style.opacity = '0'
                        setTimeout(() => confirmation.remove(), 300)
                    }, 1500)
                }
            })
            actions.appendChild(saveBtn)

            const deleteBtn = document.createElement('button')
            deleteBtn.textContent = 'Delete'
            deleteBtn.style.backgroundColor = '#f44336'
            deleteBtn.style.color = 'white'
            deleteBtn.addEventListener('click', async () => {
                if (confirm(`Delete device ${device.deviceId}?`)) {
                    await window.electronAPI.invoke(
                        'deleteDevice',
                        device.deviceId
                    )
                    loadDevices()
                }
            })
            actions.appendChild(deleteBtn)

            container.appendChild(actions)
            deviceList.appendChild(container)
        })
    }

    function createCheckbox(labelText, checked) {
        const label = document.createElement('label')
        label.textContent = labelText + ': '
        const input = document.createElement('input')
        input.type = 'checkbox'
        input.checked = checked
        return { label, input }
    }

    function createInput(labelText, value) {
        const label = document.createElement('label')
        label.textContent = labelText + ': '
        const input = document.createElement('input')
        input.type = 'number'
        input.value = value
        return { label, input }
    }

    addDeviceButton.addEventListener('click', async () => {
        await window.electronAPI.invoke('createNewDevice')
        loadDevices()
    })
})
