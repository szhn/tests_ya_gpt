const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    const connectProxyButton = document.getElementById('connect-proxy');
    const connectButton = document.getElementById('connect');
    const disconnectButton = document.getElementById('disconnect');
    const randomCheckbox = document.getElementById('random');
    const accountSelect = document.getElementById('account');
    const sendButton = document.getElementById('send');
    const streamerInput = document.getElementById('streamer');
    const messageInput = document.getElementById('message');
    const buttonsContainer = document.getElementById('custom-buttons');

    accountSelect.disabled = true;
    sendButton.disabled = true;
    connectButton.disabled = true;

    connectProxyButton.addEventListener('click', () => {
        ipcRenderer.send('connect-proxy');
    });

    ipcRenderer.on('proxy-status', (event, status) => {
        if (status.success) {
            alert('Прокси подключен успешно!');
            connectButton.disabled = false;
        } else {
            alert(`Ошибка при подключении прокси: ${status.message}`);
        }
    });

    connectButton.addEventListener('click', () => {
        const streamer = streamerInput.value.trim();
        if (streamer) {
            ipcRenderer.send('connect-accounts', streamer);
        } else {
            alert('Введите имя стримера');
        }
    });

    disconnectButton.addEventListener('click', () => {
        ipcRenderer.send('disconnect-accounts');
    });

    randomCheckbox.addEventListener('change', () => {
        accountSelect.disabled = randomCheckbox.checked;
    });

    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendButton.click();
        }
    });

    // document.addEventListener('DOMContentLoaded', () => {
    //     const collectPointsButton = document.createElement('button');
    //     collectPointsButton.id = 'collect-points';
    //     collectPointsButton.textContent = 'Собирать баллы';
    //     document.body.appendChild(collectPointsButton);
    
    //     const stopCollectPointsButton = document.createElement('button');
    //     stopCollectPointsButton.id = 'stop-collect-points';
    //     stopCollectPointsButton.textContent = 'Остановить сбор баллов';
    //     document.body.appendChild(stopCollectPointsButton);
    
    //     collectPointsButton.addEventListener('click', () => {
    //         const streamer = streamerInput.value.trim();
    //         if (streamer) {
    //             ipcRenderer.send('start-collecting-points', streamer);
    //         } else {
    //             alert('Введите имя стримера');
    //         }
    //     });
    
    //     stopCollectPointsButton.addEventListener('click', () => {
    //         ipcRenderer.send('stop-collecting-points');
    //     });
    
    //     ipcRenderer.on('collecting-points-status', (event, status) => {
    //         if (status.success) {
    //             alert(status.message);
    //         } else {
    //             alert(`Ошибка: ${status.message}`);
    //         }
    //     });
    // });
    

    ipcRenderer.on('connection-status', (event, status) => {
        if (status.success) {
            alert('Аккаунты подключены успешно!');
            accountSelect.innerHTML = '';
            Object.keys(status.accounts).forEach(username => {
                const option = document.createElement('option');
                option.value = username;
                option.text = username;
                accountSelect.appendChild(option);
            });
            accountSelect.disabled = randomCheckbox.checked;
            sendButton.disabled = false;
        } else {
            alert(`Ошибка при подключении: ${status.message}`);
        }
    });

    ipcRenderer.on('accounts-disconnected', (event, { success }) => {
        if (success) {
            alert('Аккаунты отключены.');
            accountSelect.innerHTML = '';
            sendButton.disabled = true;
        }
    });

    sendButton.addEventListener('click', () => {
        const channel = streamerInput.value.trim();
        const message = messageInput.value.trim();
        const username = accountSelect.value;
        const random = randomCheckbox.checked;

        if (channel && message) {
            ipcRenderer.send('send-message', { channel, message, username, random });
            messageInput.value = ''; 
        }
    });

    ipcRenderer.on('message-sent', (event, { success, message }) => {
        if (success) {
            console.log('Сообщение отправлено:', message);
        } else {
            alert(`Ошибка при отправке сообщения: ${message}`);
        }
    });

    ipcRenderer.on('buttons-loaded', (event, { success, buttons }) => {
        if (success) {
            buttonsContainer.innerHTML = '';
            buttons.forEach(button => {
                const btn = document.createElement('button');
                btn.textContent = button.name;
                btn.addEventListener('click', () => {
                    const randomMessage = button.messages[Math.floor(Math.random() * button.messages.length)];
                    ipcRenderer.send('send-message', { channel: button.channel, message: randomMessage, random: true });
                });
                buttonsContainer.appendChild(btn);
            });
        }
    });

    ipcRenderer.send('get-buttons');
});