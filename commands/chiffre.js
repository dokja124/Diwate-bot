/**
 * chiffre.js — Commande .chiffre : "chiffre" (encode) n'importe quel
 * fichier (document, image, vidéo, audio, sticker) envoyé en réponse
 * (reply), en le convertissant en Base64.
 * ---------------------------------------------------------------
 * Format du fichier "chiffré" (texte lisible) :
 *   CHIFFRE_B64::<mimetype>::<nomFichierOrigine>::
 *   <contenu en base64>
 *
 * La première ligne sert d'en-tête (permet à dechiffre.js de retrouver
 * le type et le nom d'origine, et de détecter qu'un fichier a déjà été
 * chiffré par ce système).
 *
 * Comment l'intégrer dans pair.js :
 * ----------------------------------
 * 1. En haut de pair.js, ajoute :
 *      const { handleChiffre } = require('./chiffre');
 *
 * 2. Dans le switch(command), ajoute :
 *      case 'chiffre': {
 *          await handleChiffre(socket, msg, sender, fakevCard, downloadContentFromMessage);
 *          break;
 *      }
 *    (downloadContentFromMessage est déjà importé depuis '@whiskeysockets/baileys'
 *    en haut de pair.js — il suffit de le passer en paramètre.)
 */

const ENTETE_PREFIX = 'CHIFFRE_B64::';

/**
 * Récupère le message média cité (document, image, vidéo, audio, sticker).
 * Retourne { objetMedia, typeMessage, mimetype, fileName } ou null.
 */
function getMediaMessageCite(msg) {
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedMsg) return null;

    const typesSupportes = ['documentMessage', 'imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage'];
    for (const type of typesSupportes) {
        if (quotedMsg[type]) {
            const objetMedia = quotedMsg[type];
            return {
                objetMedia,
                typeMessage: type.replace('Message', ''), // 'document', 'image', 'video', 'audio', 'sticker'
                mimetype: objetMedia.mimetype || 'application/octet-stream',
                fileName: objetMedia.fileName || `fichier.${(objetMedia.mimetype || '').split('/')[1] || 'bin'}`
            };
        }
    }
    return null;
}

async function telechargerBuffer(objetMedia, typeMessage, downloadContentFromMessage) {
    const stream = await downloadContentFromMessage(objetMedia, typeMessage);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

/**
 * Vérifie si un buffer est déjà "chiffré" par ce système (en-tête CHIFFRE_B64::).
 */
function estDejaChiffre(buffer) {
    const debut = buffer.subarray(0, ENTETE_PREFIX.length).toString('utf8');
    return debut === ENTETE_PREFIX;
}

/**
 * Encode un buffer + ses métadonnées au format "chiffré" (texte).
 */
function chiffrerBuffer(buffer, mimetype, fileName) {
    const entete = `${ENTETE_PREFIX}${mimetype}::${fileName}::\n`;
    const base64 = buffer.toString('base64');
    return Buffer.from(entete + base64, 'utf8');
}

/**
 * Gère la commande .chiffre.
 */
async function handleChiffre(socket, msg, sender, fakevCard, downloadContentFromMessage) {
    try {
        const media = getMediaMessageCite(msg);
        if (!media) {
            await socket.sendMessage(sender, {
                text: '❌ *Réponds à n\'importe quel fichier (document, image, vidéo, audio) avec .chiffre pour le chiffrer.*'
            }, { quoted: fakevCard || msg }).catch(() => {});
            return true;
        }

        await socket.sendMessage(sender, { react: { text: '🔐', key: msg.key } }).catch(() => {});

        const buffer = await telechargerBuffer(media.objetMedia, media.typeMessage, downloadContentFromMessage);

        if (estDejaChiffre(buffer)) {
            await socket.sendMessage(sender, {
                text: '⚠️ *Ce fichier est déjà chiffré !* Utilise .dechiffre pour le déchiffrer.'
            }, { quoted: fakevCard || msg }).catch(() => {});
            return true;
        }

        const fichierChiffre = chiffrerBuffer(buffer, media.mimetype, media.fileName);
        const nomFichierChiffre = `${media.fileName}.chiffre.txt`;

        await socket.sendMessage(sender, {
            document: fichierChiffre,
            mimetype: 'text/plain',
            fileName: nomFichierChiffre,
            caption: `🔐 *Fichier chiffré avec succès*\n\n📄 Fichier d'origine : ${media.fileName}\n\n➡️ Réponds à ce fichier avec *.dechiffre* pour le restaurer.`
        }, { quoted: fakevCard || msg });

        return true;
    } catch (error) {
        console.error('Erreur handleChiffre:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur lors du chiffrement :*\n${error.message}`
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }
}

module.exports = {
    handleChiffre,
    estDejaChiffre,
    chiffrerBuffer,
    ENTETE_PREFIX,
    getMediaMessageCite,
    telechargerBuffer
};
