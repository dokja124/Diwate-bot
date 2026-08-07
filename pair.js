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
const dns = require('dns');

// Corrige un bug fréquent sur Render/certains hébergeurs cloud : Node.js tente la résolution DNS
// en IPv6 par défaut, ce qui échoue (ENOTFOUND) si le réseau de l'hébergeur ne le supporte pas bien.
// On force IPv4 en priorité, ce qui règle la majorité des erreurs "getaddrinfo ENOTFOUND".
try {
    dns.setDefaultResultOrder('ipv4first');
} catch (e) {
    console.warn('dns.setDefaultResultOrder non disponible (nécessite Node 17+) :', e.message);
}

const { sms, downloadMediaMessage } = require("./msg");
const { REACTIONS, handleReaction } = require('./commands/react.js');
const { handleTraduction } = require('./commands/traduction.js');

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
    AUTO_VIEW_STATUS: 'true',
    AUTO_LIKE_STATUS: 'true',
    AUTO_RECORDING: 'true',
    AUTO_LIKE_EMOJI: ['💋', '😶', '✨️', '💗', '🎈', '🎉', '🥳', '❤️', '🧫', '🐭'],
    PREFIX: '.',
    MAX_RETRIES: 3,
    IMAGE_PATH: 'https://www.image2url.com/r2/default/images/1785884570239-0bcc7adc-2b29-4658-b1aa-023a91ca3b52.jpg',
    GROUP_INVITE_LINK: '',
    ADMIN_LIST_PATH: './admin.json',
    RCD_IMAGE_PATH: 'https://www.image2url.com/r2/default/images/1785884570239-0bcc7adc-2b29-4658-b1aa-023a91ca3b52.jpg',
    NEWSLETTER_JID: '120363402708281380@Newslette',
    NEWSLETTER_MESSAGE_ID: '428',
    OTP_EXPIRY: 300000,
    version: '1.0.0',
    OWNER_NUMBER: '224620769837',
    BOT_FOOTER: '> MADE IN BY Diwate',
    CHANNEL_LINK: 'https://whatsapp.com/channel/0029Vb6BuBnA2pL7ot8YLG0g'
};

const octokit = new Octokit({ auth: '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' });
const owner = 'Diwate';
const repo = 'MINI-INCONNU-XD';

const activeSockets = new Map();
const socketCreationTime = new Map();
const SESSION_BASE_PATH = './session';
const NUMBER_LIST_PATH = './numbers.json';
const otpStore = new Map();

if (!fs.existsSync(SESSION_BASE_PATH)) {
    fs.mkdirSync(SESSION_BASE_PATH, { recursive: true });
}

function loadAdmins() {
    try {
        if (fs.existsSync(config.ADMIN_LIST_PATH)) {
            return JSON.parse(fs.readFileSync(config.ADMIN_LIST_PATH, 'utf8'));
        }
        return [];
    } catch (error) {
        console.error('Failed to load admin list:', error);
        return [];
    }
}

function formatMessage(title, content, footer) {
    return `*${title}*\n\n${content}\n\n> *${footer}*`;
}

// Envoie un message avec un timeout de sécurité (évite qu'un envoi de média reste bloqué silencieusement, notamment en groupe)
async function sendMessageSafe(socket, jid, content, options, timeoutMs = 15000) {
    return Promise.race([
        socket.sendMessage(jid, content, options),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout d'envoi (${timeoutMs}ms)`)), timeoutMs))
    ]);
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getSriLankaTimestamp() {
    return moment().tz('Africa/Guinée').format('YYYY-MM-DD HH:mm:ss');
}

async function cleanDuplicateFiles(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'session'
        });

        const sessionFiles = data.filter(file =>
            file.name.startsWith(`empire_${sanitizedNumber}_`) && file.name.endsWith('.json')
        ).sort((a, b) => {
            const timeA = parseInt(a.name.match(/empire_\d+_(\d+)\.json/)?.[1] || 0);
            const timeB = parseInt(b.name.match(/empire_\d+_(\d+)\.json/)?.[1] || 0);
            return timeB - timeA;
        });

        const configFiles = data.filter(file =>
            file.name === `config_${sanitizedNumber}.json`
        );

        if (sessionFiles.length > 1) {
            for (let i = 1; i < sessionFiles.length; i++) {
                await octokit.repos.deleteFile({
                    owner,
                    repo,
                    path: `session/${sessionFiles[i].name}`,
                    message: `Delete duplicate session file for ${sanitizedNumber}`,
                    sha: sessionFiles[i].sha
                });
                console.log(`Deleted duplicate session file: ${sessionFiles[i].name}`);
            }
        }

        if (configFiles.length > 0) {
            console.log(`Config file for ${sanitizedNumber} already exists`);
        }
    } catch (error) {
        console.error(`Failed to clean duplicate files for ${number}:`, error);
    }
}

// Count total commands in pair.js
let totalcmds = async () => {
    try {
        const filePath = "./pair.js";
        const mytext = await fs.readFile(filePath, "utf-8");

        // Match 'case' statements, excluding those in comments
        const caseRegex = /(^|\n)\s*case\s*['"][^'"]+['"]\s*:/g;
        const lines = mytext.split("\n");
        let count = 0;

        for (const line of lines) {
            // Skip lines that are comments
            if (line.trim().startsWith("//") || line.trim().startsWith("/*")) continue;
            // Check if line matches case statement
            if (line.match(/^\s*case\s*['"][^'"]+['"]\s*:/)) {
                count++;
            }
        }

        return count;
    } catch (error) {
        console.error("Error reading pair.js:", error.message);
        return 0; // Return 0 on error to avoid breaking the bot
    }
};

async function joinGroup(socket) {
    let retries = config.MAX_RETRIES || 3;
    let inviteCode = 'JlI0FDZ5RpAEbeKvzAPpFt'; // Hardcoded default
    if (config.GROUP_INVITE_LINK) {
        const cleanInviteLink = config.GROUP_INVITE_LINK.split('?')[0]; // Remove query params
        const inviteCodeMatch = cleanInviteLink.match(/chat\.whatsapp\.com\/(?:invite\/)?([a-zA-Z0-9_-]+)/);
        if (!inviteCodeMatch) {
            console.error('Invalid group invite link format:', config.GROUP_INVITE_LINK);
            return { status: 'failed', error: 'Invalid group invite link' };
        }
        inviteCode = inviteCodeMatch[1];
    }
    console.log(`Attempting to join group with invite code: ${inviteCode}`);

    while (retries > 0) {
        try {
            const response = await socket.groupAcceptInvite(inviteCode);
            console.log('Group join response:', JSON.stringify(response, null, 2)); // Debug response
            if (response?.gid) {
                console.log(`[ ✅ ] Successfully joined group with ID: ${response.gid}`);
                return { status: 'success', gid: response.gid };
            }
            throw new Error('No group ID in response');
        } catch (error) {
            retries--;
            let errorMessage = error.message || 'Unknown error';
            if (error.message.includes('not-authorized')) {
                errorMessage = 'Bot is not authorized to join (possibly banned)';
            } else if (error.message.includes('conflict')) {
                errorMessage = 'Bot is already a member of the group';
            } else if (error.message.includes('gone') || error.message.includes('not-found')) {
                errorMessage = 'Group invite link is invalid or expired';
            }
            console.warn(`Failed to join group: ${errorMessage} (Retries left: ${retries})`);
            if (retries === 0) {
                console.error('[ ❌ ] Failed to join group', { error: errorMessage });
                try {
                    await socket.sendMessage(config.OWNER_NUMBER + '@s.whatsapp.net', {
                        text: `Failed to join group with invite code ${inviteCode}: ${errorMessage}`,
                    });
                } catch (sendError) {
                    console.error(`Failed to send failure message to owner: ${sendError.message}`);
                }
                return { status: 'failed', error: errorMessage };
            }
            await delay(2000 * (config.MAX_RETRIES - retries + 1));
        }
    }
    return { status: 'failed', error: 'Max retries reached' };
}

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function sendOTP(socket, number, otp) {
    const userJid = jidNormalizedUser(socket.user.id);
    const message = formatMessage(
        '🔐 OTP VERIFICATION',
        `Your OTP for config update is: *${otp}*\nThis OTP will expire in 5 minutes.`,
        'MADE IN BY Diwate'
    );

    try {
        await socket.sendMessage(userJid, { text: message });
        console.log(`OTP ${otp} sent to ${number}`);
    } catch (error) {
        console.error(`Failed to send OTP to ${number}:`, error);
        throw error;
    }
}

function setupNewsletterHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key) return;

        const allNewsletterJIDs = await loadNewsletterJIDsFromRaw();
        const jid = message.key.remoteJid;

        if (!allNewsletterJIDs.includes(jid)) return;

        try {
            const emojis = ['🩸', '🚬', '😀', '👍', '😶'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            const messageId = message.newsletterServerId;

            if (!messageId) {
                console.warn('No newsletterServerId found in message:', message);
                return;
            }

            let retries = 3;
            while (retries-- > 0) {
                try {
                    await socket.newsletterReactMessage(jid, messageId.toString(), randomEmoji);
                    console.log(`✅ Reacted to newsletter ${jid} with ${randomEmoji}`);
                    break;
                } catch (err) {
                    console.warn(`❌ Reaction attempt failed (${3 - retries}/3):`, err.message);
                    await delay(1500);
                }
            }
        } catch (error) {
            console.error('⚠️ Newsletter reaction handler failed:', error.message);
        }
    });
}

async function setupStatusHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || message.key.remoteJid !== 'status@broadcast' || !message.key.participant || message.key.remoteJid === config.NEWSLETTER_JID) return;

        try {
            if (config.AUTO_RECORDING === 'true' && message.key.remoteJid) {
                await socket.sendPresenceUpdate("recording", message.key.remoteJid);
            }

            if (config.AUTO_VIEW_STATUS === 'true') {
                let retries = config.MAX_RETRIES;
                while (retries > 0) {
                    try {
                        await socket.readMessages([message.key]);
                        break;
                    } catch (error) {
                        retries--;
                        console.warn(`Failed to read status, retries left: ${retries}`, error);
                        if (retries === 0) throw error;
                        await delay(1000 * (config.MAX_RETRIES - retries));
                    }
                }
            }

            if (config.AUTO_LIKE_STATUS === 'true') {
                const randomEmoji = config.AUTO_LIKE_EMOJI[Math.floor(Math.random() * config.AUTO_LIKE_EMOJI.length)];
                let retries = config.MAX_RETRIES;
                while (retries > 0) {
                    try {
                        await socket.sendMessage(
                            message.key.remoteJid,
                            { react: { text: randomEmoji, key: message.key } },
                            { statusJidList: [message.key.participant] }
                        );
                        console.log(`Reacted to status with ${randomEmoji}`);
                        break;
                    } catch (error) {
                        retries--;
                        console.warn(`Failed to react to status, retries left: ${retries}`, error);
                        if (retries === 0) throw error;
                        await delay(1000 * (config.MAX_RETRIES - retries));
                    }
                }
            }
        } catch (error) {
            console.error('Status handler error:', error);
        }
    });
}

async function handleMessageRevocation(socket, number) {
    socket.ev.on('messages.delete', async ({ keys }) => {
        if (!keys || keys.length === 0) return;

        const messageKey = keys[0];
        const userJid = jidNormalizedUser(socket.user.id);
        const deletionTime = getSriLankaTimestamp();

        const message = formatMessage(
            '🗑️ MESSAGE DELETED',
            `A message was deleted from your chat.\n📋 From: ${messageKey.remoteJid}\n🍁 Deletion Time: ${deletionTime}`,
            'MADE IN BY Diwate'
        );

        try {
            await socket.sendMessage(userJid, {
                image: { url: config.RCD_IMAGE_PATH },
                caption: message
            });
            console.log(`Notified ${number} about message deletion: ${messageKey.id}`);
        } catch (error) {
            console.error('Failed to send deletion notification:', error);
        }
    });
}


async function resize(image, width, height) {
    let oyy = await Jimp.read(image);
    let kiyomasa = await oyy.resize(width, height).getBufferAsync(Jimp.MIME_JPEG);
    return kiyomasa;
}

function capital(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

const createSerial = (size) => {
    return crypto.randomBytes(size).toString('hex').slice(0, size);
};

async function oneViewmeg(socket, isOwner, msg, sender) {
    if (!isOwner) {
        await socket.sendMessage(sender, {
            text: '❌ *ᴏɴʟʏ ʙᴏᴛ ᴏᴡɴᴇʀ ᴄᴀɴ ᴠɪᴇᴡ ᴏɴᴄᴇ ᴍᴇssᴀɢᴇs!*'
        });
        return;
    }
    try {
        const quoted = msg;
        let cap, anu;
        if (quoted.imageMessage?.viewOnce) {
            cap = quoted.imageMessage.caption || "";
            anu = await socket.downloadAndSaveMediaMessage(quoted.imageMessage);
            await socket.sendMessage(sender, { image: { url: anu }, caption: cap });
        } else if (quoted.videoMessage?.viewOnce) {
            cap = quoted.videoMessage.caption || "";
            anu = await socket.downloadAndSaveMediaMessage(quoted.videoMessage);
            await socket.sendMessage(sender, { video: { url: anu }, caption: cap });
        } else if (quoted.audioMessage?.viewOnce) {
            cap = quoted.audioMessage.caption || "";
            anu = await socket.downloadAndSaveMediaMessage(quoted.audioMessage);
            await socket.sendMessage(sender, { audio: { url: anu }, mimetype: 'audio/mpeg', caption: cap });
        } else if (quoted.viewOnceMessageV2?.message?.imageMessage) {
            cap = quoted.viewOnceMessageV2.message.imageMessage.caption || "";
            anu = await socket.downloadAndSaveMediaMessage(quoted.viewOnceMessageV2.message.imageMessage);
            await socket.sendMessage(sender, { image: { url: anu }, caption: cap });
        } else if (quoted.viewOnceMessageV2?.message?.videoMessage) {
            cap = quoted.viewOnceMessageV2.message.videoMessage.caption || "";
            anu = await socket.downloadAndSaveMediaMessage(quoted.viewOnceMessageV2.message.videoMessage);
            await socket.sendMessage(sender, { video: { url: anu }, caption: cap });
        } else if (quoted.viewOnceMessageV2Extension?.message?.audioMessage) {
            cap = quoted.viewOnceMessageV2Extension.message.audioMessage.caption || "";
            anu = await socket.downloadAndSaveMediaMessage(quoted.viewOnceMessageV2Extension.message.audioMessage);
            await socket.sendMessage(sender, { audio: { url: anu }, mimetype: 'audio/mpeg', caption: cap });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ *Not a valid view-once message, love!* 😢'
            });
        }
        if (anu && fs.existsSync(anu)) fs.unlinkSync(anu);
        // Clean up temporary file
    } catch (error) {
        console.error('oneViewmeg error:', error);
        await socket.sendMessage(sender, {
            text: `❌ *Failed to process view-once message, babe!* 😢\nError: ${error.message || 'Unknown error'}`
        });
    }
}

function setupCommandHandlers(socket, number) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

        const type = getContentType(msg.message);
        if (!msg.message) return;
        msg.message = (getContentType(msg.message) === 'ephemeralMessage') ? msg.message.ephemeralMessage.message : msg.message;
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const m = sms(socket, msg);
        const quoted =
            type == "extendedTextMessage" &&
                msg.message.extendedTextMessage.contextInfo != null
                ? msg.message.extendedTextMessage.contextInfo.quotedMessage || []
                : [];
        const body = (type === 'conversation') ? msg.message.conversation
            : msg.message?.extendedTextMessage?.contextInfo?.hasOwnProperty('quotedMessage')
                ? msg.message.extendedTextMessage.text
                : (type == 'interactiveResponseMessage')
                    ? msg.message.interactiveResponseMessage?.nativeFlowResponseMessage
                    && JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson)?.id
                    : (type == 'templateButtonReplyMessage')
                        ? msg.message.templateButtonReplyMessage?.selectedId
                        : (type === 'extendedTextMessage')
                            ? msg.message.extendedTextMessage.text
                            : (type == 'imageMessage') && msg.message.imageMessage.caption
                                ? msg.message.imageMessage.caption
                                : (type == 'videoMessage') && msg.message.videoMessage.caption
                                    ? msg.message.videoMessage.caption
                                    : (type == 'buttonsResponseMessage')
                                        ? msg.message.buttonsResponseMessage?.selectedButtonId
                                        : (type == 'listResponseMessage')
                                            ? msg.message.listResponseMessage?.singleSelectReply?.selectedRowId
                                            : (type == 'messageContextInfo')
                                                ? (msg.message.buttonsResponseMessage?.selectedButtonId
                                                    || msg.message.listResponseMessage?.singleSelectReply?.selectedRowId
                                                    || msg.text)
                                                : (type === 'viewOnceMessage')
                                                    ? msg.message[type]?.message[getContentType(msg.message[type].message)]
                                                    : (type === "viewOnceMessageV2")
                                                        ? (msg.message[type]?.message?.imageMessage?.caption || msg.message[type]?.message?.videoMessage?.caption || "")
                                                        : '';
        let sender = msg.key.remoteJid;
        const nowsender = msg.key.fromMe ? (socket.user.id.split(':')[0] + '@s.whatsapp.net' || socket.user.id) : (msg.key.participant || msg.key.remoteJid);
        const senderNumber = nowsender.split('@')[0];
        const developers = `${config.OWNER_NUMBER}`;
        const botNumber = socket.user.id.split(':')[0];
        const isbot = botNumber.includes(senderNumber);
        const isOwner = isbot ? isbot : developers.includes(senderNumber);
        var prefix = config.PREFIX;
        var isCmd = body.startsWith(prefix);
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith("@g.us");
        const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '.';
        var args = body.trim().split(/ +/).slice(1);

        // Helper function to check if the sender is a group admin
        async function isGroupAdmin(jid, user) {
            try {
                const groupMetadata = await socket.groupMetadata(jid);
                const participant = groupMetadata.participants.find(p => p.id === user);
                return participant?.admin === 'admin' || participant?.admin === 'superadmin' || false;
            } catch (error) {
                console.error('Error checking group admin status:', error);
                return false;
            }
        }

        // isSenderGroupAdmin n'est calculé que si une commande l'utilise réellement (évite un appel réseau à chaque message du groupe)
        let _isSenderGroupAdminCache = null;
        const isSenderGroupAdmin = async () => {
            if (_isSenderGroupAdminCache === null) {
                _isSenderGroupAdminCache = isGroup ? await isGroupAdmin(from, nowsender) : false;
            }
            return _isSenderGroupAdminCache;
        };

        socket.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
            let quoted = message.msg ? message.msg : message;
            let mime = (message.msg || message).mimetype || '';
            let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
            const stream = await downloadContentFromMessage(quoted, messageType);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            let type = await FileType.fromBuffer(buffer);
            trueFileName = attachExtension ? (filename + '.' + type.ext) : filename;
            await fs.writeFileSync(trueFileName, buffer);
            return trueFileName;
        };

        if (!command) return;
        const count = await totalcmds();

        // =============================================
        // ✅ GESTION DES RÉACTIONS (GIFs)
        // =============================================
        if (REACTIONS[command]) {
            await handleReaction(socket, msg, sender, isGroup, command, args, nowsender);
            return;
        }

        // =============================================
        // ✅ GESTION DE LA TRADUCTION
        // =============================================
        // Note : La vérification se fait dans le switch plus bas
        // Ne pas ajouter de condition ici

        // Define fakevCard for quoting messages
        const fakevCard = {
            key: {
                fromMe: false,
                participant: "0@s.whatsapp.net",
                remoteJid: "status@broadcast"
            },
            message: {
                contactMessage: {
                    displayName: "© Diwate-bot  ✅",
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:Meta\nORG:META AI;\nTEL;type=CELL;type=VOICE;waid=2250576991050:+2250576991050\nEND:VCARD`
                }
            }
        };

        try {
            switch (command) {
                // =============================================
                // MENU
                // =============================================
                case 'menu':
                case 'allmenu': {
                    await socket.sendMessage(sender, { react: { text: '📋', key: msg.key } });
                    const menuText = `
╭───────────────⭓
│ ʙᴏᴛ: *Diwate-bot*
│ ᴘʀᴇғɪx: ${config.PREFIX}
│ ᴅᴇᴠ: *Diwate*
╰───────────────⭓

⭓───────────────⭓『 📋 ᴄᴏᴍᴍᴀɴᴅs 』
│ 🍁 ${config.PREFIX}spam <numéro>
│ 🍁 ${config.PREFIX}traduit <langue> <texte>
╰──────────────────⭓

⭓───────────────⭓『 ✨ GIFS ✨ 』
│ 🍁 ${config.PREFIX}gifle @qui
│ 🍁 ${config.PREFIX}calin @qui
│ 🍁 ${config.PREFIX}bisou @qui
│ 🍁 ${config.PREFIX}caresse @qui
│ 🍁 ${config.PREFIX}titille @qui
│ 🍁 ${config.PREFIX}mordre @qui
│ 🍁 ${config.PREFIX}tue @qui
│ 🍁 ${config.PREFIX}envoie @qui
│ 🍁 ${config.PREFIX}blottis @qui
│ 🍁 ${config.PREFIX}danse @qui
│ 🍁 ${config.PREFIX}boum @qui
│ 🍁 ${config.PREFIX}clin @qui
│ 🍁 ${config.PREFIX}tape @qui
╰──────────────────⭓

⭓───────────────⭓『 🤖 AI 🤖 』
│ 🍁 ${config.PREFIX}traduit en <langue>
│    (répondre à un message)
╰──────────────────⭓
> *Diwate-bot*
`;
                    try {
                        await sendMessageSafe(socket, sender, {
                            image: { url: config.RCD_IMAGE_PATH },
                            caption: menuText
                        }, { quoted: fakevCard });
                    } catch (error) {
                        console.error('Menu command error:', error);
                        await socket.sendMessage(sender, { text: menuText }, { quoted: fakevCard })
                            .catch(err => console.error('Menu fallback text failed too:', err));
                    }
                    break;
                }

                // =============================================
                // SPAM
                // =============================================
                case 'spam': {
                    await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

                    if (!isOwner) {
                        await socket.sendMessage(sender, { 
                            text: '❌ *Seul le propriétaire peut utiliser cette commande.*' 
                        }, { quoted: fakevCard });
                        break;
                    }

                    if (args.length === 0) {
                        await socket.sendMessage(sender, { 
                            text: `📌 *Usage:* ${prefix}spam +225xxxxxxx` 
                        }, { quoted: fakevCard });
                        break;
                    }

                    const numeroCible = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
                    const nombreDeFois = parseInt(args[1]) || 50;
                    const intervalleSecondes = parseFloat(args[2]) || 1;
                    const longueurCode = 8;

                    if (nombreDeFois < 5) {
                        await socket.sendMessage(sender, { 
                            text: '⚠️ *Minimum 5 spams !*' 
                        }, { quoted: fakevCard });
                        break;
                    }

                    const { makeid } = require("./id.js");

                    await socket.sendMessage(sender, { 
                        text: `💥 *SPAM ACTIVÉ*\n\n📝 *Cible :* ${args[0]}\n🔢 *Nombre :* ${nombreDeFois} codes\n🔑 *Longueur :* ${longueurCode} caractères\n⏰ *Intervalle :* ${intervalleSecondes}s\n\n⏳ *Envoi en cours...*` 
                    }, { quoted: fakevCard });

                    let compteur = 0;
                    let codes = [];

                    console.log(`💥 Spam vers ${args[0]} - ${nombreDeFois} codes (8 caractères)`);
                    console.log("=" .repeat(50));

                    const intervalle = setInterval(() => {
                        compteur++;
                        const code = makeid(8);
                        codes.push(code);
                        
                        console.log(`[${compteur}/${nombreDeFois}] Code : ${code} → ${args[0]}`);
                        
                        socket.sendMessage(numeroCible, { 
                            text: `🔑 *Spam*\n\n*${code}*\n\n⏰ Valable quelques minutes.\n🔒 Ne partagez pas ce code.` 
                        });

                        if (compteur >= nombreDeFois) {
                            clearInterval(intervalle);
                            
                            console.log("=" .repeat(50));
                            console.log(`✅ FIN : ${nombreDeFois} Spam envoyés à ${args[0]}`);
                            
                            socket.sendMessage(sender, { 
                                text: `✅ *SPAM TERMINÉ !*\n\n📝 *Cible :* ${args[0]}\n🔢 *Total :* ${nombreDeFois} codes envoyés\n🔑 *Longueur :* 8 caractères\n⏱️ *Durée :* ${(compteur * intervalleSecondes).toFixed(0)} secondes\n\n📋 *Dernier code :* ${code}` 
                            }, { quoted: fakevCard });
                        }
                    }, intervalleSecondes * 1000);

                    break;
                }

                // =============================================
                // TRADUCTION
                // =============================================
                case 'traduit':
                case 'traduction':
                case 'translate':
                    await handleTraduction(socket, msg, sender, args, prefix, fakevCard, isOwner);
                    break;

                // =============================================
                // COMMANDE PAR DÉFAUT
                // =============================================
                default:
                    // Ne rien faire si la commande n'est pas reconnue
                    break;
            }
        } catch (error) {
            console.error('Command handler error:', error);
            await socket.sendMessage(sender, {
                text: formatMessage(
                    '❌ ERROR',
                    'La commande a eu un bug. Veuillez réessayer.',
                    'Diwate-bot'
                )
            }).catch(err => console.error('Fallback error message failed too:', err));
        }
    });
}

function setupMessageHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

        if (config.AUTO_RECORDING === 'true') {
            try {
                await socket.sendPresenceUpdate('recording', msg.key.remoteJid);
                console.log(`Set recording presence for ${msg.key.remoteJid}`);
            } catch (error) {
                console.error('Failed to set recording presence:', error);
            }
        }
    });
}

async function deleteSessionFromGitHub(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'session'
        });

        const sessionFiles = data.filter(file =>
            file.name.includes(sanitizedNumber) && file.name.endsWith('.json')
        );

        for (const file of sessionFiles) {
            await octokit.repos.deleteFile({
                owner,
                repo,
                path: `session/${file.name}`,
                message: `Delete session for ${sanitizedNumber}`,
                sha: file.sha
            });
            console.log(`Deleted GitHub session file: ${file.name}`);
        }

        // Update numbers.json on GitHub
        let numbers = [];
        if (fs.existsSync(NUMBER_LIST_PATH)) {
            numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8'));
            numbers = numbers.filter(n => n !== sanitizedNumber);
            fs.writeFileSync(NUMBER_LIST_PATH, JSON.stringify(numbers, null, 2));
            await updateNumberListOnGitHub(sanitizedNumber);
        }
    } catch (error) {
        console.error('Failed to delete session from GitHub:', error);
    }
}

async function restoreSession(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'session'
        });

        const sessionFiles = data.filter(file =>
            file.name === `creds_${sanitizedNumber}.json`
        );

        if (sessionFiles.length === 0) return null;

        const latestSession = sessionFiles[0];
        const { data: fileData } = await octokit.repos.getContent({
            owner,
            repo,
            path: `session/${latestSession.name}`
        });

        const content = Buffer.from(fileData.content, 'base64').toString('utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error('Session restore failed:', error);
        return null;
    }
}

async function loadUserConfig(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const configPath = `session/config_${sanitizedNumber}.json`;
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: configPath
        });

        const content = Buffer.from(data.content, 'base64').toString('utf8');
        return JSON.parse(content);
    } catch (error) {
        console.warn(`No configuration
