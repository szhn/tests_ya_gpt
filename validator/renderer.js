const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('start-validation');
    const statusDiv = document.getElementById('status');

    startButton.addEventListener('click', () => {
        statusDiv.textContent = 'Проверка аккаунтов...';
        ipcRenderer.send('start-validation');
    });

    ipcRenderer.on('validation-complete', (event, result) => {
        if (result.success) {
            statusDiv.textContent = `Проверка завершена. Валидных аккаунтов: ${result.count}`;
        } else {
            statusDiv.textContent = `Ошибка: ${result.message}`;
        }
    });
});
