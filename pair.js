const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const router = express.Router();
const pino = require('pino');
const cheerio = require('cheerio');
const { Octokit } = require('@octokit/rest');
const moment = require('moment-timezone');
const Jimp = require('jimp');
const crypto = require('crypto');
const axios = require('axios');
const FormData = require("form-data");
const os = require('os');
const { sms, downloadMediaMessage } = require("./msg");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    getContentType,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    downloadContentFromMessage,
    proto,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    S_WHATSAPP_NET
} = require('@whiskeysockets/baileys');
    
const config = {
    PREFIX: '.',
    OWNER_NUMBER: '2250576991050',
    BOT_FOOTER: '> MADE IN BY Diwate',
    RCD_IMAGE_PATH: 'https://www.image2url.com/r2/default/images/1785884570239-0bcc7adc-2b29-4658-b1aa-023a91ca3b52.jpg',
    ADMIN_LIST_PATH: './admin.json',
    MAX_RETRIES: 3,
    SESSION_BASE_PATH: './sessions',
    NUMBER_LIST_PATH: './numbers.json'
};

const octokit = new Octokit({ auth: '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' });
const owner = 'Diwate';
const repo = 'Diwate-ban';

// Stockage des clients WPPConnect
const activeClients = new Map();
const clientCreationTime = new Map();

// === FONCTIONS DE SESSION (adaptées pour WPPConnect) ===

async function restoreSession(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: `session/session_${sanitizedNumber}.json`
        });
        const content = Buffer.from(data.content, 'base64').toString('utf8');
        return JSON.parse(content);
    } catch (error) {
        return null;
    }
}

async function saveSessionToGitHub(number, sessionData) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const sessionPath = `session/session_${sanitizedNumber}.json`;
        let sha;

        try {
            const { data } = await octokit.repos.getContent({ owner, repo, path: sessionPath });
            sha = data.sha;
        } catch (error) { /* Fichier n'existe pas */ }

        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: sessionPath,
            message: `Update session for ${sanitizedNumber}`,
            content: Buffer.from(JSON.stringify(sessionData, null, 2)).toString('base64'),
            sha
        });
        console.log(`✅ Session sauvegardée pour ${sanitizedNumber}`);
    } catch (error) {
        console.error('❌ Erreur sauvegarde session:', error.message);
    }
}

function formatMessage(title, content, footer) {
    return `*${title}*\n\n${content}\n\n> *${footer}*`;
}

// === COMMANDE .ban AVEC SIGNALEMENT ===

function setupCommandHandlers(client, number) {
    client.onMessage(async (message) => {
        // Ignorer les messages du bot lui-même
        if (message.isGroupMsg || message.sender.id === client.info.wid) return;

        const body = message.body || '';
        const prefix = config.PREFIX;
        if (!body.startsWith(prefix)) return;

        const command = body.slice(prefix.length).trim().split(' ').shift().toLowerCase();
        const args = body.trim().split(/ +/).slice(1);
        const sender = message.from;
        const senderNumber = sender.split('@')[0];
        const isOwner = senderNumber === config.OWNER_NUMBER;

        // Vérification admin
        let admins = [];
        try {
            if (fs.existsSync(config.ADMIN_LIST_PATH)) {
                admins = JSON.parse(fs.readFileSync(config.ADMIN_LIST_PATH, 'utf8'));
            }
        } catch (error) {
            console.error('Erreur chargement admins:', error);
        }

        const isAdmin = isOwner || admins.includes(senderNumber);

        switch (command) {
            case 'ban': {
                // Réaction
                await client.sendMessageWithReaction(message.chatId, message.id, '🚫');

                if (!isAdmin) {
                    await client.sendTextMessage(sender, '❌ *Seul le propriétaire/admin peut utiliser cette commande.*');
                    break;
                }

                if (args.length === 0) {
                    await client.sendTextMessage(sender, `📌 *Usage:* ${prefix}ban +225xxxxxxx`);
                    break;
                }

                try {
                    const numberToBan = args[0].replace(/[^0-9]/g, '') + '@c.us';
                    
                    // 1. Envoyer le message de confirmation
                    await client.sendTextMessage(sender, `⏳ *Signalement en cours pour ${args[0]}...*`);

                    // 2. BLOQUER LOCALEMENT
                    try {
                        await client.blockContact(numberToBan);
                        console.log(`🔒 Bloqué: ${numberToBan}`);
                    } catch (blockError) {
                        console.warn('⚠️ Erreur blocage (peut-être déjà bloqué):', blockError.message);
                    }

                    // 3. SIGNALEMENT À WHATSAPP (LA PARTIE QUI MANQUAIT)
                    try {
                        // Récupérer le chat pour le signaler
                        const chat = await client.getChat(numberToBan);
                        if (chat) {
                            // Signalement du chat entier
                            await client.reportSpam(chat, 'ChatInfoReport');
                            console.log(`📢 Signalement envoyé: ${numberToBan}`);
                            
                            // Attendre un peu
                            await new Promise(r => setTimeout(r, 1500));
                            
                            // Si le message était une réponse, signaler aussi le message spécifique
                            if (message.quotedMsg) {
                                const quotedMsg = await client.getMessageById(message.quotedMsg.id);
                                if (quotedMsg) {
                                    await client.reportSpam(chat, 'MessageMenu', quotedMsg);
                                    console.log(`📢 Signalement du message spécifique envoyé`);
                                }
                            }
                        }
                    } catch (reportError) {
                        console.error('❌ Erreur signalement:', reportError.message);
                        await client.sendTextMessage(sender, 
                            `⚠️ *Signalement partiel* (blocage réussi mais erreur signalement: ${reportError.message})`
                        );
                    }

                    // 4. Confirmation finale
                    await new Promise(r => setTimeout(r, 2000));
                    await client.sendTextMessage(sender, 
                        formatMessage(
                            '✅ COMPTE SIGNALÉ & BLOQUÉ',
                            `▪️ Numéro: *${args[0]}*\n▪️ Statut: *Bloqué + signalé à WhatsApp*\n▪️ Action: Le compte sera examiné par WhatsApp.`,
                            config.BOT_FOOTER
                        )
                    );
                    await client.sendMessageWithReaction(message.chatId, message.id, '✅');

                } catch (error) {
                    console.error('❌ Erreur ban:', error);
                    await client.sendTextMessage(sender, `❌ *Erreur:* ${error.message || 'Inconnue'}`);
                }
                break;
            }

            case 'unban': {
                if (!isAdmin) {
                    await client.sendTextMessage(sender, '❌ *Seul le propriétaire/admin peut utiliser cette commande.*');
                    break;
                }
                if (args.length === 0) {
                    await client.sendTextMessage(sender, `📌 *Usage:* ${prefix}unban +224xxxxxxx`);
                    break;
                }
                const numberToUnban = args[0].replace(/[^0-9]/g, '') + '@c.us';
                try {
                    await client.unblockContact(numberToUnban);
                    await client.sendTextMessage(sender, `✅ *Débloqué: ${args[0]}*`);
                } catch (error) {
                    await client.sendTextMessage(sender, `❌ *Erreur:* ${error.message}`);
                }
                break;
            }

            case 'checkblock': {
                if (!isAdmin) {
                    await client.sendTextMessage(sender, '❌ *Seul le propriétaire/admin peut utiliser cette commande.*');
                    break;
                }
                if (args.length === 0) {
                    await client.sendTextMessage(sender, `📌 *Usage:* ${prefix}checkblock +224xxxxxxx`);
                    break;
                }
                const numberToCheck = args[0].replace(/[^0-9]/g, '') + '@c.us';
                try {
                    const blocklist = await client.getBlockList();
                    const isBlocked = blocklist.includes(numberToCheck);
                    await client.sendTextMessage(sender, 
                        isBlocked ? `🔴 *${args[0]}* est BLOQUÉ` : `🟢 *${args[0]}* n'est PAS bloqué`
                    );
                } catch (error) {
                    await client.sendTextMessage(sender, `❌ *Erreur:* ${error.message}`);
                }
                break;
            }

            case 'menu': {
                const menuText = `
╭───────────────⭓
│ ʙᴏᴛ: *Diwate-ban*
│ ᴘʀᴇғɪx: ${config.PREFIX}
│ ᴅᴇᴠ: *Diwate*
╰───────────────⭓

⭓───────────────⭓『 📋 ᴄᴏᴍᴍᴀɴᴅs 』
│ 🚫 ${config.PREFIX}ban <numéro> → bloque + signalement
│ 🔍 ${config.PREFIX}checkblock <numéro> → vérifie
╰──────────────────⭓
> *Diwate-ban - Signalement intégré*
`;
                await client.sendImage(sender, config.RCD_IMAGE_PATH, 'menu.jpg', menuText);
                break;
            }
        }
    });
}

// === CONNEXION PRINCIPALE (WPPConnect) ===

async function startWPPClient(number, res) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const sessionName = `session_${sanitizedNumber}`;

    // Vérifier si déjà connecté
    if (activeClients.has(sanitizedNumber)) {
        if (res) {
            return res.status(200).send({ status: 'already_connected', number: sanitizedNumber });
        }
        return;
    }

    try {
        // Restaurer session depuis GitHub
        const restoredSession = await restoreSession(sanitizedNumber);
        let sessionData = restoredSession || {};

        // Créer le client WPPConnect
        const client = await wppconnect.create({
            session: sessionName,
            headless: true,
            autoClose: false,
            catchQR: (base64Qr, asciiQR) => {
                console.log(`📱 QR Code pour ${sanitizedNumber}:`);
                console.log(asciiQR);
                if (res && !res.headersSent) {
                    res.send({ 
                        status: 'qr_ready', 
                        number: sanitizedNumber,
                        qr: asciiQR,
                        qrBase64: base64Qr
                    });
                }
            },
            statusFind: (statusSession, session) => {
                console.log(`📊 ${sanitizedNumber} - Status: ${statusSession}`);
                
                if (statusSession === 'connected') {
                    console.log(`✅ ${sanitizedNumber} connecté!`);
                    activeClients.set(sanitizedNumber, client);
                    clientCreationTime.set(sanitizedNumber, Date.now());

                    // Sauvegarder la session sur GitHub
                    const currentSession = client.getSession();
                    if (currentSession) {
                        saveSessionToGitHub(sanitizedNumber, currentSession);
                    }

                    // Ajouter aux nombres
                    let numbers = [];
                    if (fs.existsSync(config.NUMBER_LIST_PATH)) {
                        numbers = JSON.parse(fs.readFileSync(config.NUMBER_LIST_PATH, 'utf8'));
                    }
                    if (!numbers.includes(sanitizedNumber)) {
                        numbers.push(sanitizedNumber);
                        fs.writeFileSync(config.NUMBER_LIST_PATH, JSON.stringify(numbers, null, 2));
                    }

                    // Configurer les handlers
                    setupCommandHandlers(client, sanitizedNumber);

                    // Envoyer message de bienvenue
                    client.sendTextMessage(client.info.wid, 
                        `✅ *Bot connecté!*\n\n` +
                        `📱 Numéro: ${sanitizedNumber}\n` +
                        `⏰ ${new Date().toLocaleString()}\n\n` +
                        `Tapez *${config.PREFIX}menu* pour voir les commandes.`
                    );
                }
            },
            browserArgs: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        // Si la session est déjà connectée (pas de QR)
        if (client && client.info && client.info.wid) {
            activeClients.set(sanitizedNumber, client);
            clientCreationTime.set(sanitizedNumber, Date.now());
            setupCommandHandlers(client, sanitizedNumber);
            
            if (res && !res.headersSent) {
                res.send({ status: 'connected', number: sanitizedNumber });
            }
        }

        return client;

    } catch (error) {
        console.error('❌ Erreur connexion WPPConnect:', error);
        if (res && !res.headersSent) {
            res.status(500).send({ error: error.message });
        }
        return null;
    }
}

// === ROUTES EXPRESS ===

router.get('/', async (req, res) => {
    const { number } = req.query;
    if (!number) {
        return res.status(400).send({ error: 'Number parameter is required' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    if (activeClients.has(sanitizedNumber)) {
        return res.status(200).send({ 
            status: 'already_connected',
            number: sanitizedNumber
        });
    }

    await startWPPClient(number, res);
});

router.get('/active', (req, res) => {
    res.status(200).send({
        count: activeClients.size,
        numbers: Array.from(activeClients.keys())
    });
});

router.get('/ping', (req, res) => {
    res.status(200).send({
        status: 'active',
        message: 'Diwate-ban (WPPConnect)',
        activesession: activeClients.size
    });
});

router.get('/reconnect', async (req, res) => {
    try {
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'session'
        });

        const sessionFiles = data.filter(file => 
            file.name.startsWith('session_') && file.name.endsWith('.json')
        );

        const results = [];
        for (const file of sessionFiles) {
            const match = file.name.match(/session_(\d+)\.json/);
            if (!match) continue;

            const number = match[1];
            if (activeClients.has(number)) {
                results.push({ number, status: 'already_connected' });
                continue;
            }

            await startWPPClient(number, null);
            results.push({ number, status: 'connection_initiated' });
            await new Promise(r => setTimeout(r, 3000));
        }

        res.status(200).send({ status: 'success', connections: results });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// === NETTOYAGE ===
process.on('exit', () => {
    activeClients.forEach((client, number) => {
        try {
            client.close();
        } catch (error) {
            console.error(`Erreur fermeture ${number}:`, error);
        }
        activeClients.delete(number);
    });
});

module.exports = router;
