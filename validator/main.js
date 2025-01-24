const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const tmi = require('tmi.js');
const { Worker } = require('worker_threads');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    mainWindow.webContents.openDevTools();
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (mainWindow === null) createWindow();
});

ipcMain.on('start-validation', async (event) => {
    try {
        const tokens = JSON.parse(fs.readFileSync(path.join(__dirname, 'pretokens.json'), 'utf8'));
        const validTokens = {};

        const validationPromises = Object.entries(tokens).map(([username, token]) => 
            new Promise((resolve) => {
                const worker = new Worker(path.join(__dirname, 'tokenValidator.js'), { workerData: { token } });
                worker.on('message', (isValid) => {
                    if (isValid) {
                        validTokens[username] = token;
                    }
                    resolve();
                });
                worker.on('error', (err) => {
                    console.error(`Ошибка в воркере для ${username}:`, err);
                    resolve();
                });
            })
        );

        await Promise.all(validationPromises);

        const clients = [];
        const finalValidTokens = {};
        for (const [username, token] of Object.entries(validTokens)) {
            try {
                const client = new tmi.Client({
                    options: { debug: false },
                    connection: {
                        reconnect: true,
                        secure: true
                    },
                    identity: {
                        username: username,
                        password: `oauth:${token}`
                    },
                    channels: ['urbanpma']
                });

                await client.connect();
                clients.push(client);

                await new Promise((resolve) => setTimeout(resolve, 500)); 

                await client.say('urbanpma', 'test123');

                finalValidTokens[username] = token;
                console.log(`Сообщение отправлено от ${username}`);
                client.disconnect();
            } catch (error) {
                console.error(`Ошибка при отправке сообщения от ${username}:`, error);
            }
        }

        fs.writeFileSync(
            path.join(__dirname, 'validtokens.json'),
            JSON.stringify(finalValidTokens, null, 2),
            'utf8'
        );

        event.reply('validation-complete', { success: true, count: Object.keys(finalValidTokens).length });
    } catch (error) {
        console.error('Ошибка:', error);
        event.reply('validation-complete', { success: false, message: error.message });
    }
});
