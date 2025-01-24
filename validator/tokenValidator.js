const { parentPort, workerData } = require('worker_threads');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function validateToken(token) {
    try {
        const response = await fetch('https://id.twitch.tv/oauth2/validate', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        return data.client_id !== undefined; // Если client_id есть, токен валиден
    } catch {
        return false;
    }
}

validateToken(workerData.token).then((isValid) => {
    parentPort.postMessage(isValid);
});
