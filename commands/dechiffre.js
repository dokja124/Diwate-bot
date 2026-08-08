/**
 * dechiffre.js — Commande .dechiffre : déchiffre (décode) n'importe quel
 * fichier envoyé en réponse (reply), qu'il ait été chiffré par .chiffre
 * (notre format CHIFFRE_B64::) ou qu'il s'agisse simplement d'un fichier
 * en base64 générique (venant d'ailleurs).
 * ---------------------------------------------------------------
 * Voir chiffre.js pour le format du fichier chiffré et les instructions
 * d'intégration complètes dans pair.js.
 *
 * Comment l'intégrer dans pair.js :
 * ----------------------------------
 * 1. En haut de pair.js, ajoute :
 *      const { handleDechiffre } = require('./dechiffre');
 *
 * 2. Dans le switch(command), ajoute :
 *      case 'dechiffre': {
 *          await handleDechiffre(socket, msg, sender, fakevCard, downloadContentFromMessage);
 *          break;
 *      }
 */

const { estDejaChiffre, ENTETE_PREFIX, getMediaMessageCite, telechargerBuffer } = require('./chiffre');

// Signatures (magic bytes) des formats de fichiers les plus courants,
// pour deviner le type d'un fichier base64 générique (sans nos métadonnées).
const SIGNATURES = [
    { bytes: [0x89, 0x50, 0x4E, 0x47], mimetype: 'image/png', ext: 'png' },
    { bytes: [0xFF, 0xD8, 0xFF], mimetype: 'image/jpeg', ext: 'jpg' },
    { bytes: [0x47, 0x49, 0x46, 0x38], mimetype: 'image/gif', ext: 'gif' },
    { bytes: [0x25, 0x50, 0x44, 0x46], mimetype: 'application/pdf', ext: 'pdf' },
    { bytes: [0x50, 0x4B, 0x03, 0x04], mimetype: 'application/zip', ext: 'zip' },
    { bytes: [0x52, 0x49, 0x46, 0x46], mimetype: 'audio/wav', ext: 'wav' }, // RIFF (WAV ou AVI)
    { bytes: [0x49, 0x44, 0x33], mimetype: 'audio/mpeg', ext: 'mp3' },
];

function devinerType(buffer) {
    for (const sig of SIGNATURES) {
        if (buffer.length >= sig.bytes.length &&
            sig.bytes.every((b, i) => buffer[i] === b)) {
            return { mimetype: sig.mimetype, ext: sig.ext };
        }
    }
    // MP4 / vidéos: signature "ftyp" à l'offset 4
    if (buffer.length >= 8 &&
        buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
        return { mimetype: 'video/mp4', ext: 'mp4' };
    }
    return { mimetype: 'application/octet-stream', ext: 'bin' };
}

/**
 * Vérifie si un buffer, une fois converti en texte, ressemble à du base64
 * valide (uniquement des caractères base64 + retours à la ligne éventuels).
 */
function ressembleABase64(texte) {
    const nettoye = texte.replace(/\s+/g, '');
    if (nettoye.length === 0 || nettoye.length % 4 !== 0) return false;
    return /^[A-Za-z0-9+/]+={0,2}$/.test(nettoye);
}

/**
 * Gère la commande .dechiffre.
 */
async function handleDechiffre(socket, msg, sender, fakevCard, downloadContentFromMessage) {
    try {
        const media = getMediaMessageCite(msg);
        if (!media) {
            await socket.sendMessage(sender, {
                text: '❌ *Réponds à un fichier chiffré avec .dechiffre pour le restaurer.*'
            }, { quoted: fakevCard || msg }).catch(() => {});
            return true;
        }

        await socket.sendMessage(sender, { react: { text: '🔓', key: msg.key } }).catch(() => {});

        const buffer = await telechargerBuffer(media.objetMedia, media.typeMessage, downloadContentFromMessage);

        let contenuDechiffre;
        let mimetype;
        let fileName;

        if (estDejaChiffre(buffer)) {
            // --- Cas 1 : fichier chiffré par notre propre .chiffre ---
            const texte = buffer.toString('utf8');
            const finEntete = texte.indexOf('\n');
            const entete = texte.slice(0, finEntete);
            const base64 = texte.slice(finEntete + 1).trim();

            const parties = entete.split('::'); // ['CHIFFRE_B64', '<mimetype>', '<fileName>', '']
            mimetype = parties[1] || 'application/octet-stream';
            fileName = parties[2] || 'fichier_dechiffre';
            contenuDechiffre = Buffer.from(base64, 'base64');

        } else {
            // --- Cas 2 : fichier base64 générique (pas chiffré par nous) ---
            const texteBrut = buffer.toString('utf8');
            if (!ressembleABase64(texteBrut)) {
                await socket.sendMessage(sender, {
                    text: "⚠️ *Ce fichier ne semble pas être chiffré (ni au format base64).* Impossible de le déchiffrer."
                }, { quoted: fakevCard || msg }).catch(() => {});
                return true;
            }

            contenuDechiffre = Buffer.from(texteBrut.replace(/\s+/g, ''), 'base64');
            const typeDevine = devinerType(contenuDechiffre);
            mimetype = typeDevine.mimetype;
            fileName = `fichier_dechiffre.${typeDevine.ext}`;
        }

        const caption = `🔓 *Fichier déchiffré avec succès*\n\n📄 ${fileName}`;

        if (mimetype.startsWith('image/')) {
            await socket.sendMessage(sender, { image: contenuDechiffre, caption }, { quoted: fakevCard || msg });
        } else if (mimetype.startsWith('video/')) {
            await socket.sendMessage(sender, { video: contenuDechiffre, caption }, { quoted: fakevCard || msg });
        } else if (mimetype.startsWith('audio/')) {
            await socket.sendMessage(sender, { audio: contenuDechiffre, mimetype, ptt: false }, { quoted: fakevCard || msg });
        } else {
            await socket.sendMessage(sender, {
                document: contenuDechiffre,
                mimetype,
                fileName,
                caption
            }, { quoted: fakevCard || msg });
        }

        return true;
    } catch (error) {
        console.error('Erreur handleDechiffre:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur lors du déchiffrement :*\n${error.message}`
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }
}

module.exports = { handleDechiffre };
