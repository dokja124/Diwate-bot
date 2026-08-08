/**
 * url.js — Commande .url : renvoie un lien direct vers la photo/vidéo citée.
 */

const axios = require('axios');
const FormData = require('form-data');

/**
 * Récupère le message cité et tente d'extraire le média
 */
function getQuotedMessage(msg) {
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    if (!contextInfo) return null;

    // Essayer plusieurs chemins possibles
    let quoted = contextInfo.quotedMessage;
    if (!quoted) return null;

    // Si quotedMessage est vide, on vérifie s'il y a un media dans contextInfo directement
    if (Object.keys(quoted).length === 0) {
        // Parfois le média est directement dans contextInfo
        if (contextInfo.imageMessage) return { imageMessage: contextInfo.imageMessage };
        if (contextInfo.videoMessage) return { videoMessage: contextInfo.videoMessage };
        if (contextInfo.documentMessage) return { documentMessage: contextInfo.documentMessage };
        return null;
    }

    return quoted;
}

/**
 * Extrait le média d'un message cité
 */
function extractMedia(quoted) {
    if (!quoted) return null;

    const types = ['imageMessage', 'videoMessage', 'documentMessage', 'stickerMessage', 'audioMessage'];
    for (const type of types) {
        if (quoted[type]) {
            return { mediaType: type.replace('Message', ''), mediaMsg: quoted[type] };
        }
    }

    // Vérifier si le message cité contient un extendedTextMessage avec un média
    if (quoted.extendedTextMessage) {
        const subQuoted = quoted.extendedTextMessage.contextInfo?.quotedMessage;
        if (subQuoted) {
            for (const type of types) {
                if (subQuoted[type]) {
                    return { mediaType: type.replace('Message', ''), mediaMsg: subQuoted[type] };
                }
            }
        }
    }

    return null;
}

/**
 * Télécharge le média cité
 */
async function downloadMedia(socket, msg) {
    try {
        // 1. Récupérer le message cité
        const quoted = getQuotedMessage(msg);
        if (!quoted) {
            console.log('❌ Aucun message cité trouvé.');
            return null;
        }

        console.log('📌 Clés du message cité:', Object.keys(quoted));

        // 2. Extraire le média du message cité
        const media = extractMedia(quoted);
        if (!media) {
            console.log('❌ Aucun média trouvé dans le message cité.');
            return null;
        }

        const { mediaType, mediaMsg } = media;
        console.log(`✅ Média trouvé : ${mediaType}`);

        // 3. Télécharger le média
        const buffer = await socket.downloadMediaMessage(quoted);
        if (!buffer) {
            console.log('❌ Échec du téléchargement du média.');
            return null;
        }

        return { buffer, mediaType, mediaMsg };
    } catch (error) {
        console.error('❌ Erreur dans downloadMedia:', error.message);
        return null;
    }
}

/**
 * Upload vers Catbox
 */
async function uploadToCatbox(buffer, filename) {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', buffer, filename);

    try {
        const response = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: { ...form.getHeaders() },
            timeout: 30000
        });
        return response.data.trim();
    } catch (error) {
        console.error('❌ Erreur upload Catbox:', error.message);
        throw new Error('Échec de l\'upload vers l\'hébergeur.');
    }
}

/**
 * Commande .url
 */
async function handleUrl(socket, msg, sender, fakevCard) {
    try {
        const result = await downloadMedia(socket, msg);
        if (!result) {
            await socket.sendMessage(sender, {
                text: '❌ *Aucun média cité détecté.*\n\n📌 *Comment utiliser .url :*\n1. Envoie une photo ou une vidéo\n2. **Réponds** à ce message (glisse vers la droite) en tapant `.url`\n\n🔍 *Astuce :* Le bot cherche un média dans le message auquel tu réponds.'
            }, { quoted: fakevCard || msg });
            return true;
        }

        const { buffer, mediaType } = result;
        const ext = mediaType === 'image' ? 'jpg' : mediaType === 'video' ? 'mp4' : 'bin';
        const filename = `media_${Date.now()}.${ext}`;

        const publicUrl = await uploadToCatbox(buffer, filename);

        await socket.sendMessage(sender, {
            text: `✅ *Lien ${mediaType === 'image' ? 'de l\'image' : mediaType === 'video' ? 'de la vidéo' : 'du fichier'} :*\n${publicUrl}\n\n🔗 *Cliquez pour visualiser ou télécharger.*`
        }, { quoted: fakevCard || msg });

        return true;
    } catch (error) {
        console.error('❌ Erreur handleUrl:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur :*\n${error.message}`
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }
}

module.exports = { handleUrl };
