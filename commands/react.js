const axios = require('axios');
const { generateWAMessage, proto, downloadContentFromMessage } = require('@whiskeysockets/baileys');

// =============================================
// 1. CONFIGURATION GIPHY
// =============================================
const GIPHY_API_KEY = 'iYRaPBSF9m5Dzbpwofz7UNrwFW2E2sNn'; // Ta clé API

// Commande (en français) -> { search term, verbe utilisé dans le texte }
const REACTIONS = {
    gifle:    { search: 'slap',     verb: 'gifle' },
    tape:     { search: 'punch',    verb: 'frappe' },
    boum:     { search: 'kick',     verb: 'donne un coup de pied à' },
    tue:      { search: 'shoot',    verb: 'tire sur' },
    calin:    { search: 'hug',      verb: 'fait un câlin à' },
    blottis:  { search: 'cuddle',   verb: 'se blottit contre' },
    bisou:    { search: 'kiss',     verb: 'embrasse' },
    embrasse: { search: 'kiss',     verb: 'embrasse' },
    caresse:  { search: 'pat',      verb: 'caresse' },
    titille:  { search: 'tickle',   verb: 'chatouille' },
    mordre:   { search: 'bite',     verb: 'mord' },
    envoie:   { search: 'yeet',     verb: 'envoie valser' },
    danse:    { search: 'dance',    verb: 'danse avec' },
    clin:     { search: 'wink',     verb: 'fait un clin d\'œil à' },
    sourire:  { search: 'smile',    verb: 'sourit à' },
    coucou:   { search: 'wave',     verb: 'salue' },
    triste:   { search: 'cry',      verb: 'pleure devant' },
    dodo:     { search: 'sleep',    verb: 's\'endort avec' },
    content:  { search: 'happy',    verb: 'est content(e) avec' },
};

// =============================================
// 2. RÉCUPÉRATION DES GIFS DEPUIS GIPHY
// =============================================
/**
 * Récupère un gif aléatoire depuis GIPHY
 */
async function fetchGiphyGif(searchTerm) {
    try {
        // Ajouter "anime" pour avoir plus de résultats animés
        const query = `${searchTerm} anime`;
        const limit = 20;
        const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&rating=g`;

        const response = await axios.get(url, { timeout: 10000 });
        const gifs = response.data.data;

        if (!gifs || gifs.length === 0) {
            throw new Error(`Aucun GIF GIPHY trouvé pour "${searchTerm}"`);
        }

        // Sélectionner un GIF aléatoire
        const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
        
        // GIPHY fournit le GIF en MP4 (parfait pour WhatsApp)
        const gifUrl = randomGif.images.original.mp4 || randomGif.images.downsized.mp4;
        
        if (!gifUrl) {
            throw new Error('URL du GIF GIPHY non trouvée');
        }

        return { 
            url: gifUrl,
            title: randomGif.title || searchTerm,
            username: randomGif.username || 'GIPHY'
        };
    } catch (error) {
        console.error(`Erreur fetchGiphyGif:`, error.message);
        throw new Error(`Impossible de récupérer un GIF GIPHY pour "${searchTerm}"`);
    }
}

// =============================================
// 3. TÉLÉCHARGEMENT DU GIF
// =============================================
/**
 * Télécharge un GIF depuis une URL
 */
async function downloadGif(url) {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const buffer = Buffer.from(response.data);
        
        if (!buffer || buffer.length === 0) {
            throw new Error('Le fichier téléchargé est vide');
        }

        return buffer;
    } catch (error) {
        console.error('Erreur téléchargement GIF:', error.message);
        throw new Error('Impossible de télécharger le GIF');
    }
}

// =============================================
// 4. DÉTERMINER LA CIBLE
// =============================================
/**
 * Détermine le jid de la personne visée par la réaction
 */
function resolveTarget(msg, args) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (mentioned && mentioned.length > 0) return mentioned[0];

    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    if (quotedParticipant) return quotedParticipant;

    if (args.length > 0) {
        const digits = args[0].replace(/[^0-9]/g, '');
        if (digits.length >= 8) return `${digits}@s.whatsapp.net`;
    }

    return null;
}

// =============================================
// 5. ENVOI DE LA RÉACTION
// =============================================
/**
 * Gère l'envoi d'une commande de réaction (avec upload sur WhatsApp)
 */
async function handleReaction(socket, msg, sender, isGroup, command, args, nowsender) {
    const reaction = REACTIONS[command];
    if (!reaction) return false;

    try {
        // Accusé de réception
        await socket.sendMessage(sender, { react: { text: '💫', key: msg.key } }).catch(() => {});

        // 1. Récupérer l'URL du GIF depuis GIPHY
        const gif = await fetchGiphyGif(reaction.search);
        
        // 2. Télécharger le GIF en buffer
        const gifBuffer = await downloadGif(gif.url);

        // 3. Construire la légende
        let target = resolveTarget(msg, args);
        let caption = '';
        let mentions = [];

        if (target) {
            const authorTag = `@${(nowsender || sender).split('@')[0]}`;
            const targetTag = `@${target.split('@')[0]}`;
            caption = `${authorTag} ${reaction.verb} ${targetTag} ! ❤️`;
            mentions = [nowsender, target].filter(Boolean);
        } else {
            if (isGroup) {
                const authorTag = `@${(nowsender || sender).split('@')[0]}`;
                caption = `${authorTag} ${reaction.verb} tout le monde ! 😄`;
                mentions = [nowsender].filter(Boolean);
            } else {
                caption = `💫 ${reaction.verb} en GIF !`;
                mentions = [];
            }
        }

        // =============================================
        // 6. ENVOI AVEC UPLOAD SUR WHATSAPP
        // =============================================

        try {
            // Méthode 1 : generateWAMessage (la plus fiable)
            const waMessage = await generateWAMessage(
                sender,
                {
                    video: gifBuffer,
                    gifPlayback: true,
                    caption: caption,
                    mentions: mentions
                },
                {
                    quoted: msg,
                    userJid: socket.user.id,
                    upload: socket.waUploadToServer
                }
            );

            await socket.relayMessage(sender, waMessage.message, {
                messageId: waMessage.key.id
            });

            console.log(`✅ GIF GIPHY envoyé pour "${command}"`);
            
        } catch (uploadError) {
            // Fallback : méthode avec prepareMessageMedia
            console.warn('Fallback vers prepareMessageMedia:', uploadError.message);
            
            const media = await socket.prepareMessageMedia(
                { video: gifBuffer, gifPlayback: true, caption, mentions },
                { mediaType: 'video', upload: true }
            );
            
            await socket.sendMessage(sender, {
                video: media,
                gifPlayback: true,
                caption,
                mentions
            }, { quoted: msg });
        }

        return true;
    } catch (error) {
        console.error(`Erreur commande "${command}":`, error.message);
        
        try {
            await socket.sendMessage(sender, {
                text: `❌ *Impossible d'envoyer le GIF pour "${command}".*\nErreur : ${error.message}`
            }, { quoted: msg });
        } catch (e) {
            console.error('Erreur fallback:', e.message);
        }
        
        return true;
    }
}

// =============================================
// 7. EXPORTS
// =============================================
module.exports = { REACTIONS, handleReaction, fetchGiphyGif };
