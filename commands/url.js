/**
 * url.js — Commande .url : renvoie un lien direct vers la photo/vidéo citée.
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs-extra');
const path = require('path');

async function downloadMedia(socket, msg) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) {
        console.log('❌ Aucun message cité trouvé.');
        return null;
    }

    // 🔍 Log pour voir ce qui est cité
    console.log('📌 Message cité :', Object.keys(quoted));

    // Détection du type de média
    let mediaType = null;
    let mediaMsg = null;

    if (quoted.imageMessage) {
        mediaType = 'image';
        mediaMsg = quoted.imageMessage;
    } else if (quoted.videoMessage) {
        mediaType = 'video';
        mediaMsg = quoted.videoMessage;
    } else if (quoted.documentMessage) {
        mediaType = 'document';
        mediaMsg = quoted.documentMessage;
    } else if (quoted.stickerMessage) {
        // Pour les stickers (optionnel)
        mediaType = 'sticker';
        mediaMsg = quoted.stickerMessage;
    } else {
        console.log('❌ Type de média non reconnu dans le message cité.');
        return null;
    }

    try {
        const buffer = await socket.downloadMediaMessage(quoted);
        if (!buffer) {
            console.log('❌ Téléchargement du média échoué (buffer null).');
            return null;
        }
        return { buffer, mediaType, mediaMsg };
    } catch (error) {
        console.error('❌ Erreur téléchargement média:', error.message);
        return null;
    }
}

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

async function handleUrl(socket, msg, sender, fakevCard) {
    try {
        const result = await downloadMedia(socket, msg);
        if (!result) {
            await socket.sendMessage(sender, {
                text: '❌ *Aucun média cité détecté.*\nAssure-toi de **répondre directement** à une photo ou une vidéo avec `.url`.\n\n🔍 *Astuce :* glisse vers la droite sur le message contenant le média et tape `.url`.'
            }, { quoted: fakevCard || msg });
            return true;
        }

        const { buffer, mediaType, mediaMsg } = result;
        const ext = mediaType === 'image' ? 'jpg' : mediaType === 'video' ? 'mp4' : mediaType === 'sticker' ? 'webp' : 'bin';
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
