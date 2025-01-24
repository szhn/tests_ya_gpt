const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const tmi = require('tmi.js');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const tunnel = require('tunnel');

let mainWindow;
let chatWindow;
let playerWindow;
let validAccounts = {};
let clients = [];
let lastUsedAccount = null;
let proxyAgent = null;
let pointsWorker = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    // mainWindow.webContents.openDevTools();
}

function createChatWindow(streamer) {
    chatWindow = new BrowserWindow({
        width: 400,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    chatWindow.loadURL(`https://www.twitch.tv/popout/${streamer}/chat`);
    // chatWindow.webContents.openDevTools();
}

function createPlayerWindow(streamer) {
    playerWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    playerWindow.loadURL(`https://www.twitch.tv/${streamer}`);
    // playerWindow.webContents.openDevTools();
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
    if (mainWindow === null) createWindow();
});

if (isMainThread) {
    ipcMain.on('connect-proxy', async (event) => {
        console.log('Подключение к прокси...');
        try {
            const proxyConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'proxy.json'), 'utf8'));
            const [auth, hostPort] = proxyConfig.split('@');
            const [host, port] = hostPort.split(':');

            proxyAgent = tunnel.httpsOverHttp({
                proxy: {
                    host: host,
                    port: parseInt(port),
                    proxyAuth: auth 
                }
            });

            // Проверка подключения прокси
            const testClient = new tmi.Client({
                options: { debug: true },
                connection: {
                    reconnect: true,
                    secure: true,
                    agent: proxyAgent
                },
                identity: {
                    username: 'pinkwv_40',
                    password: '49r7mzmbfifey261z59z9pix7dn3os'
                },
                channels: ['pinkwv_40']
            });

            await testClient.connect();
            await testClient.disconnect();

            console.log(`Прокси подключен и работает: ${host}:${port}`);
            event.reply('proxy-status', { success: true, message: 'Прокси подключен и работает' });
        } catch (error) {
            console.error('Ошибка при подключении к прокси:', error.message);
            event.reply('proxy-status', { success: false, message: 'Не удалось подключиться к прокси' });
        }
    });

    ipcMain.on('connect-accounts', async (event, streamer) => {
        console.log('Валидация токенов аккаунтов...');
        try {
            const tokens = JSON.parse(fs.readFileSync(path.join(__dirname, 'tokens.json'), 'utf8'));

            const validationPromises = Object.entries(tokens).map(([username, token]) =>
                new Promise((resolve) => {
                    const worker = new Worker(path.join(__dirname, 'tokenValidator.js'), { workerData: { token } });
                    worker.on('message', (isValid) => {
                        if (isValid) {
                            validAccounts[username] = token;
                            console.log(`Токен для ${username} валиден`);

                            const client = new tmi.Client({
                                options: { debug: false },
                                connection: {
                                    reconnect: true,
                                    secure: true,
                                    agent: proxyAgent
                                },
                                identity: {
                                    username: username,
                                    password: `oauth:${token}`
                                },
                                channels: [username]
                            });

                            client.connect().then(() => {
                                clients.push(client);
                                resolve(true);
                            }).catch((error) => {
                                console.error(`Ошибка при подключении аккаунта ${username}:`, error);
                                resolve(false);
                            });
                        } else {
                            console.log(`Токен для ${username} не валиден`);
                            resolve(false);
                        }
                    });
                    worker.on('error', (err) => {
                        console.error(`Ошибка в воркере для ${username}:`, err);
                        resolve(false);
                    });
                })
            );

            await Promise.all(validationPromises);

            if (Object.keys(validAccounts).length > 0) {
                event.reply('connection-status', { success: true, accounts: validAccounts });
                createChatWindow(streamer);
                createPlayerWindow(streamer);
            } else {
                throw new Error('Ни один токен не валиден');
            }
        } catch (error) {
            console.error('Ошибка при валидации токенов:', error.message);
            event.reply('connection-status', { success: false, message: 'Не удалось валидировать токены' });
        }
    });

    ipcMain.on('send-message', (event, { channel, message, username, random }) => {
        let userClient;

        if (random) {
            const availableClients = clients.filter(client => client.getUsername() !== lastUsedAccount);
            if (availableClients.length > 0) {
                userClient = availableClients[Math.floor(Math.random() * availableClients.length)];
            } else {
                userClient = clients[Math.floor(Math.random() * clients.length)];
            }
        } else {
            userClient = clients.find(client => client.getUsername() === username);
        }

        if (userClient && userClient.readyState() === 'OPEN') {
            lastUsedAccount = userClient.getUsername();
            userClient.say(channel, message).then(() => {
                event.reply('message-sent', { success: true, message: 'Сообщение отправлено' });
            }).catch((error) => {
                console.error('Ошибка при отправке сообщения:', error);
                event.reply('message-sent', { success: false, message: 'Не удалось отправить сообщение' });
            });
        } else {
            event.reply('message-sent', { success: false, message: 'Клиент не подключен или аккаунт не найден' });
        }
    });

    ipcMain.on('disconnect-accounts', (event) => {
        clients.forEach(client => client.disconnect());
        clients = [];
        validAccounts = {};
        lastUsedAccount = null;
        console.log('Все аккаунты отключены.');
        event.reply('accounts-disconnected', { success: true });
            
        if (chatWindow) {
            chatWindow.close();
            chatWindow = null;
        }
        if (playerWindow) {
            playerWindow.close();
            playerWindow = null;
        }
    });


    // ipcMain.on('start-collecting-points', (event, streamer) => {
    // if (pointsWorker) {
    //     event.reply('collecting-points-status', { success: false, message: 'Сбор баллов уже запущен' });
    //     return;
    // }

    // if (!validAccounts || Object.keys(validAccounts).length === 0) {
    //     event.reply('collecting-points-status', { success: false, message: 'Нет подключенных аккаунтов' });
    //     return;
    // }

    // const accounts = Object.entries(validAccounts).map(([username, token]) => ({ username, token }));

    // pointsWorker = new Worker(path.join(__dirname, 'pointCollector.js'), {
    //     workerData: { accounts, streamer }
    // });

    // pointsWorker.on('message', (status) => {
    //     if (status.success) {
    //         console.log('Сбор баллов запущен');
    //         event.reply('collecting-points-status', { success: true, message: 'Сбор баллов запущен' });
    //     } else {
    //         console.error('Ошибка сбора баллов:', status.message);
    //         pointsWorker = null;
    //         event.reply('collecting-points-status', { success: false, message: status.message });
    //     }
    // });

    // pointsWorker.on('error', (err) => {
    //     console.error('Ошибка воркера сбора баллов:', err.message);
    //     pointsWorker = null;
    // });

    // pointsWorker.on('exit', (code) => {
    //     if (code !== 0) console.error('Воркер сбора баллов завершился с ошибкой');
    //     pointsWorker = null;
    // });
// });

    // ipcMain.on('stop-collecting-points', (event) => {
    //     if (pointsWorker) {
    //         pointsWorker.terminate();
    //         pointsWorker = null;
    //         console.log('Сбор баллов остановлен');
    //         event.reply('collecting-points-status', { success: true, message: 'Сбор баллов остановлен' });
    //     } else {
    //         event.reply('collecting-points-status', { success: false, message: 'Сбор баллов не запущен' });
    //     }
    // });


    ipcMain.on('get-buttons', (event) => {
        try {
            const buttons = JSON.parse(fs.readFileSync(path.join(__dirname, 'buttons.json'), 'utf8'));
            event.reply('buttons-loaded', { success: true, buttons });
        } catch (error) {
            console.error('Ошибка загрузки кнопок:', error.message);
            event.reply('buttons-loaded', { success: false, message: 'Не удалось загрузить кнопки' });
        }
    });
}