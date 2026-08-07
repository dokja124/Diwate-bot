const axios = require('axios');

// Commande (en français) -> { search term, verbe utilisé dans le texte }
const REACTIONS = {
    gifle:    { search: 'slap anime',    verb: 'gifle' },
    tape:     { search: 'punch anime',   verb: 'frappe' },
    boum:     { search: 'kick anime',    verb: 'donne un coup de pied à' },
    tue:      { search: 'shoot anime',   verb: 'tire sur' },
    calin:    { search: 'hug anime',     verb: 'fait un câlin à' },
    blottis:  { search: 'cuddle anime',  verb: 'se blottit contre' },
    bisou:    { search: 'kiss anime',    verb: 'embrasse' },
    embrasse: { search: 'kiss anime',    verb: 'embrasse' },
    caresse:  { search: 'pat anime',     verb: 'caresse' },
    titille:  { search: 'tickle anime',  verb: 'chatouille' },
    mordre:   { search: 'bite anime',    verb: 'mord' },
    envoie:   { search: 'yeet anime',    verb: 'envoie valser' },
    danse:    { search: 'dance anime',   verb: 'danse avec' },
    clin:     { search: 'wink anime',    verb: 'fait un clin d\'œil à' },
    sourire:  { search: 'smile anime',   verb: 'sourit à' },
    coucou:   { search: 'wave anime',    verb: 'salue' },
    triste:   { search: 'cry anime',     verb: 'pleure devant' },
    dodo:     { search: 'sleep anime',   verb: 's\'endort avec' },
    content:  { search: 'happy anime',   verb: 'est content(e) avec' },
};

/**
 * Récupère un gif aléatoire depuis l'API interne de Discord (Tenor)
 * pour un terme de recherche donné.
 */
async function fetchDiscordGif(searchTerm) {
    try {
        const url = `https://discord.com/api/v9/gifs/search?q=${encodeURIComponent(searchTerm)}&media_format=gif&provider=tenor&locale=en-US`;
        
        const { data } = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });

        if (!data || data.length === 0) {
            throw new Error(`Aucun résultat pour la recherche "${searchTerm}"`);
        }

        // Sélectionner un GIF aléatoire
        const randomGif = data[Math.floor(Math.random() * data.length)];
        
        // L'URL peut être dans différentes propriétés
        const gifUrl = randomGif.src || randomGif.url || randomGif.media?.url;
        
        if (!gifUrl) {
            throw new Error('URL du GIF non trouvée dans la réponse');
        }

        return { url: gifUrl };
    } catch (error) {
        console.error(`Erreur fetchDiscordGif pour "${searchTerm}":`, error.message);
        throw new Error(`Impossible de récupérer un GIF pour "${searchTerm}"`);
    }
}

/**
 * Télécharge un GIF et le convertit en Buffer
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
        
        // Vérifier que le buffer n'est pas vide
        if (!buffer || buffer.length === 0) {
            throw new Error('Le fichier téléchargé est vide');
        }

        // Vérifier que c'est bien un GIF (magic number: GIF87a ou GIF89a)
        const isGif = buffer.length > 6 && 
            buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
        
        if (!isGif) {
            console.warn('⚠️ Le fichier téléchargé n\'est pas un GIF valide');
        }

        return buffer;
    } catch (error) {
        console.error('Erreur lors du téléchargement du GIF:', error.message);
        throw new Error('Impossible de télécharger le GIF');
    }
}

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

/**
 * Gère l'envoi d'une commande de réaction.
 */
async function handleReaction(socket, msg, sender, isGroup, command, args, nowsender) {
    const reaction = REACTIONS[command];
    if (!reaction) return false;

    try {
        // Accusé de réception
        await socket.sendMessage(sender, { react: { text: '💫', key: msg.key } }).catch(() => {});

        // Récupérer l'URL du GIF
        const gif = await fetchDiscordGif(reaction.search);
        
        // Télécharger le GIF en buffer
        const gifBuffer = await downloadGif(gif.url);

        // Trouver la cible
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
        // ✅ ENVOI DU GIF EN TANT QUE VIDÉO
        // =============================================
        await socket.sendMessage(sender, {
            video: gifBuffer,
            gifPlayback: true,
            caption: caption,
            mentions: mentions,
            mimetype: 'video/mp4' // Pour assurer la compatibilité
        }, { quoted: msg });

        console.log(`✅ GIF envoyé pour la commande "${command}"`);

        return true;
    } catch (error) {
        console.error(`Erreur commande de réaction "${command}":`, error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Impossible de récupérer le gif pour "${command}" pour le moment.*\nErreur : ${error.message}`
        }, { quoted: msg }).catch(() => {});
        return true;
    }
}

module.exports = { REACTIONS, handleReaction, fetchDiscordGif };
