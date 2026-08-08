/**
 * url.js — Commande .url : renvoie un lien direct vers la photo/vidéo citée.
 * Adapté pour gérer le message courant ou le message cité.
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs-extra');
const path = require('path');

// =============================================
// 1. UPLOAD SUR CATBOX
// =============================================
async function uploadToCatbox(buffer, filename) {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', buffer, filename);

    try {
        const response = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: { ...form.getHeaders() },
            timeout: 60000
        });
        return response.data.trim();
    } catch (error) {
        console.error('❌ Erreur upload Catbox:', error.message);
        throw new Error('Échec de l\'upload vers Catbox.');
    }
}

// =============================================
// 2. RÉCUPÉRATION DU MÉDIA (BUFFER + EXTENSION)
// =============================================
async function getMediaBufferAndExt(socket, message) {
    try {
        const m = message.message || {};

        if (m.imageMessage) {
            const buffer = await socket.downloadMediaMessage(m.imageMessage);
            return { buffer, ext: '.jpg' };
        }
        if (m.videoMessage) {
            const buffer = await socket.downloadMediaMessage(m.videoMessage);
            return { buffer, ext: '.mp4' };
        }
        if (m.audioMessage) {
            const buffer = await socket.downloadMediaMessage(m.audioMessage);
            return { buffer, ext: '.mp3' };
        }
        if (m.documentMessage) {
            const buffer = await socket.downloadMediaMessage(m.documentMessage);
            const fileName = m.documentMessage.fileName || 'file.bin';
            const ext = path.extname(fileName) || '.bin';
            return { buffer, ext };
        }
        if (m.stickerMessage) {
            const buffer = await socket.downloadMediaMessage(m.stickerMessage);
            return { buffer, ext: '.webp' };
        }
        return null;
    } catch (error) {
        console.error('❌ Erreur getMediaBufferAndExt:', error.message);
        return null;
    }
}

async function getQuotedMediaBufferAndExt(socket, message) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) return null;
    return getMediaBufferAndExt(socket, { message: quoted });
}

// =============================================
// 3. COMMANDE PRINCIPALE .url
// =============================================
async function handleUrl(socket, msg, sender, fakevCard) {
    try {
        // 1. Essayer le message courant (si l'utilisateur a envoyé un média avec .url)
        let media = await getMediaBufferAndExt(socket, msg);
        // 2. Sinon, essayer le message cité (réponse à un média)
        if (!media) media = await getQuotedMediaBufferAndExt(socket, msg);

        if (!media) {
            await socket.sendMessage(sender, {
                text: '❌ *Aucun média trouvé.*\n\n📌 *Utilisation :*\n1. Envoie une photo, vidéo, sticker, audio ou document\n2. **Réponds** à ce message en tapant `.url`\n\n⚠️ *Important :* glisse vers la droite sur le message média pour répondre.'
            }, { quoted: fakevCard || msg });
            return true;
        }

        const { buffer, ext } = media;
        const filename = `media_${Date.now()}${ext}`;

        const publicUrl = await uploadToCatbox(buffer, filename);

        // Étiquette du type
        const typeLabels = {
            '.jpg': '📷 image',
            '.png': '📷 image',
            '.webp': '🎨 sticker',
            '.mp4': '🎥 vidéo',
            '.mp3': '🎵 audio',
            '.bin': '📄 document'
        };
        const label = typeLabels[ext] || '📄 fichier';

        await socket.sendMessage(sender, {
            text: `✅ *Lien de la ${label} :*\n${publicUrl}\n\n🔗 *Cliquez pour visualiser ou télécharger.*`
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
