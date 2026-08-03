const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  Browsers,
} = require('@whiskeysockets/baileys');

const handleMessages = require('./handler');

// Garde une référence des sessions actives en mémoire (number -> sock)
const sessions = {};

async function startSession(number) {
  const sessionPath = path.join(__dirname, 'session', number);
  await fs.ensureDir(sessionPath);
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome'),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      console.log(`✅ Connecté : ${number}`);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === 401; // DisconnectReason.loggedOut

      console.log(`❌ Déconnecté : ${number} (code: ${statusCode || 'inconnu'})`);

      if (loggedOut) {
        console.log(`🚫 Session invalide pour ${number}, il faut re-pairer via /code?number=${number}`);
        delete sessions[number];
      } else {
        console.log(`🔁 Reconnexion automatique pour ${number}...`);
        delete sessions[number];
        startSession(number).catch((e) =>
          console.error(`Erreur lors de la reconnexion de ${number}:`, e)
        );
      }
    }
  });

  // C'est ici que chaque message reçu passe par le gestionnaire de commandes
  sock.ev.on('messages.upsert', async (m) => {
    try {
      await handleMessages(sock, m);
    } catch (e) {
      console.error('Erreur handler:', e);
    }
  });

  sessions[number] = sock;
  return sock;
}

router.get('/', async (req, res) => {
  const number = (req.query.number || '').replace(/[^0-9]/g, '');
  if (!number) {
    return res.status(400).json({ error: 'Numéro manquant' });
  }

  try {
    const sock = await startSession(number);

    if (!sock.authState.creds.registered) {
      await delay(1500);
      const code = await sock.requestPairingCode(number);
      return res.json({ code });
    } else {
      return res.json({ code: 'DEJA_CONNECTE' });
    }
  } catch (err) {
    console.error('Erreur pairing:', err);
    return res.status(500).json({ error: 'Service Unavailable' });
  }
});

module.exports = router;
        
