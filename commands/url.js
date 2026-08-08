const axios = require('axios');
const FormData = require('form-data');

/**
 * Commande .url
 * Répondre (reply) à une image ou une vidéo avec ".url" pour recevoir
 * le lien direct du média (hébergé sur catbox.moe — gratuit, sans clé API).
 *
 * @param {object} socket - Le socket Baileys actif
 * @param {object} msg - Le message WhatsApp reçu (contient .key pour la réaction/quote)
 * @param {string} sender - Le JID du destinataire de la réponse
 * @param {object} fakevCard - La carte utilisée pour "quoted" dans les réponses du bot
 * @param {object|array} quoted - Le message cité (contextInfo.quotedMessage), déjà extrait dans pair.js
 * @param {function} downloadContentFromMessage - Fonction Baileys pour télécharger le média cité
 */
async function handleUrl(socket, msg, sender, fakevCard, quoted, downloadContentFromMessage) {
    try {
        const hasMedia = quoted && !Array.isArray(quoted) &&
            (quoted.imageMessage || quoted.videoMessage || quoted.stickerMessage);

        if (!hasMedia) {
            await socket.sendMessage(sender, {
                text: '❌ *Réponds à une image ou une vidéo avec la commande .url*'
            }, { quoted: fakevCard });
            return;
        }

        await socket.sendMessage(sender, { react: { text: '🔗', key: msg.key } }).catch(() => {});

        let mediaMessage;
        let downloadType;
        let extension;

        if (quoted.imageMessage) {
            mediaMessage = quoted.imageMessage;
            downloadType = 'image';
            extension = 'jpg';
        } else if (quoted.videoMessage) {
            mediaMessage = quoted.videoMessage;
            downloadType = 'video';
            extension = 'mp4';
        } else {
            mediaMessage = quoted.stickerMessage;
            downloadType = 'image';
            extension = 'webp';
        }

        // Téléchargement du média cité
        const stream = await downloadContentFromMessage(mediaMessage, downloadType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        if (!buffer.length) {
            throw new Error('Média vide après téléchargement');
        }

        // Upload vers catbox.moe : service gratuit, sans clé API, lien direct permanent
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', buffer, { filename: `diwate_${Date.now()}.${extension}` });

        const { data } = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: form.getHeaders(),
            timeout: 30000
        });

        const link = typeof data === 'string' ? data.trim() : '';

        if (!link.startsWith('http')) {
            throw new Error(`Réponse inattendue du service d'hébergement: ${link}`);
        }

        await socket.sendMessage(sender, {
            text: `🔗 *Voici le lien de ton média :*\n\n${link}`
        }, { quoted: fakevCard });

    } catch (error) {
        console.error('Erreur commande .url :', error);
        await socket.sendMessage(sender, {
            text: '❌ *Une erreur est survenue lors de la récupération du lien. Réessaie.*'
        }, { quoted: fakevCard });
    }
}

module.exports = { handleUrl };
