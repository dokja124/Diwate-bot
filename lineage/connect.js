const path = require('path');
const fs = require('fs');
const pino = require('pino');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');

const handleMessages = require('../handler');

const SESSION_DIR = path.join(__dirname, '..', 'session');

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const logger = pino({ level: 'fatal' }).child({ level: 'fatal' });

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        printQRInTerminal: false,
        logger,
        syncFullHistory: false,
        browser: Browsers.macOS('Safari')
    });

    sock.ev.on('creds.update', saveCreds);

    // Branche le handler de commandes sur les messages entrants
    sock.ev.on('messages.upsert', (m) => handleMessages(sock, m));

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log('✅ Bot connecté et prêt à recevoir des commandes');
        } else if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (statusCode !== 401) {
                console.log('🔁 Reconnexion...');
                await delay(2000);
                startBot();
            } else {
                console.log('❌ Session invalide, reconnexion requise (scan/pairing)');
            }
        }
    });
}

startBot();

module.exports = startBot;
