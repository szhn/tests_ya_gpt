const { parentPort, workerData } = require('worker_threads');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function validateToken(token) {
    try {
        const response = await fetch('https://id.twitch.tv/oauth2/validate', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        return data.client_id !== undefined;
    } catch (error) {
        console.error('Ошибка при валидации токена:', error);
        return false;
    }
}

validateToken(workerData.token).then((isValid) => {
    parentPort.postMessage(isValid);
});
