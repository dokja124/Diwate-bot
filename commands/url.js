/**
 * url.js — Commande .url : renvoie un lien direct vers la photo/vidéo citée.
 * ---------------------------------------------------------------
 * Le bot télécharge le média cité et l'upload sur un hébergeur gratuit
 * (catbox.moe) pour obtenir un lien public permanent.
 *
 * Comment l'intégrer dans pair.js :
 * ----------------------------------
 * 1. En haut de pair.js, ajoute :
 *      const { handleUrl } = require('./url');
 * 2. Dans le switch(command), ajoute :
 *      case 'url': {
 *          await handleUrl(socket, msg, sender, fakevCard);
 *          break;
 *      }
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs-extra');
const path = require('path');
const { pipeline } = require('stream/promises');

// =============================================
// 1. TÉLÉCHARGEMENT DU MÉDIA
// =============================================
async function downloadMedia(socket, msg) {
    // Récupère le message cité
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) return null;

    // Détermine le type de média
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
    } else {
        return null; // pas de média
    }

    // Télécharger le buffer via Baileys
    try {
        const buffer = await socket.downloadMediaMessage(quoted);
        if (!buffer) return null;
        return { buffer, mediaType, mediaMsg };
    } catch (error) {
        console.error('Erreur téléchargement média:', error.message);
        return null;
    }
}

// =============================================
// 2. UPLOAD SUR HÉBERGEUR (catbox.moe)
// =============================================
async function uploadToCatbox(buffer, filename) {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', buffer, filename);

    try {
        const response = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: { ...form.getHeaders() },
            timeout: 30000 // 30 secondes
        });
        return response.data.trim(); // retourne l'URL directe
    } catch (error) {
        console.error('Erreur upload Catbox:', error.message);
        throw new Error('Échec de l\'upload vers l\'hébergeur.');
    }
}

// =============================================
// 3. COMMANDE PRINCIPALE .url
// =============================================
async function handleUrl(socket, msg, sender, fakevCard) {
    try {
        const result = await downloadMedia(socket, msg);
        if (!result) {
            await socket.sendMessage(sender, {
                text: '❌ *Aucun média cité.*\nVeuillez répondre à une photo ou une vidéo avec `.url`.'
            }, { quoted: fakevCard || msg });
            return true;
        }

        const { buffer, mediaType, mediaMsg } = result;
        // Générer un nom de fichier
        const ext = mediaType === 'image' ? 'jpg' : mediaType === 'video' ? 'mp4' : 'bin';
        const filename = `media_${Date.now()}.${ext}`;

        // Upload sur Catbox
        const publicUrl = await uploadToCatbox(buffer, filename);

        // Réponse
        await socket.sendMessage(sender, {
            text: `✅ *Lien ${mediaType === 'image' ? 'de l\'image' : 'de la vidéo'} :*\n${publicUrl}\n\n🔗 *Cliquez sur le lien pour visualiser/télécharger.*`
        }, { quoted: fakevCard || msg });

        return true;
    } catch (error) {
        console.error('Erreur handleUrl:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur :*\n${error.message}`
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }
}

module.exports = { handleUrl };
