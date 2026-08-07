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
        const gifUrl = randomGif.src || randomGif.url;
        
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
 * Détermine le jid de la personne visée par la réaction :
 * 1. Une mention (@numéro) dans le message
 * 2. Le participant du message cité (reply)
 * 3. Un numéro passé en argument
 * Retourne null si aucune cible n'est trouvée.
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
 * @param {object} socket - le socket Baileys
 * @param {object} msg - le message reçu
 * @param {string} sender - le jid où répondre (groupe ou privé)
 * @param {boolean} isGroup - si le message vient d'un groupe
 * @param {string} command - la commande utilisée (ex: 'gifle')
 * @param {string[]} args - les arguments de la commande
 * @param {string} nowsender - le jid réel de l'auteur du message
 */
async function handleReaction(socket, msg, sender, isGroup, command, args, nowsender) {
    const reaction = REACTIONS[command];
    if (!reaction) return false;

    try {
        // Accusé de réception
        await socket.sendMessage(sender, { react: { text: '💫', key: msg.key } }).catch(() => {});

        // Récupérer le GIF
        const gif = await fetchDiscordGif(reaction.search);
        
        // === MODIFICATION PRINCIPALE ===
        // 1. Essayer de trouver une cible (mention, reply, argument)
        let target = resolveTarget(msg, args);
        let caption = '';
        let mentions = [];

        if (target) {
            // Si une cible est trouvée, on l'envoie à cette personne
            const authorTag = `@${(nowsender || sender).split('@')[0]}`;
            const targetTag = `@${target.split('@')[0]}`;
            caption = `${authorTag} ${reaction.verb} ${targetTag} !`;
            mentions = [nowsender, target].filter(Boolean);
        } else {
            // ✅ SI AUCUNE CIBLE : envoi aléatoire "à tout le monde" ou en message privé
            if (isGroup) {
                // Dans un groupe : message général
                const authorTag = `@${(nowsender || sender).split('@')[0]}`;
                caption = `${authorTag} ${reaction.verb} tout le monde ! 😄`;
                mentions = [nowsender].filter(Boolean);
            } else {
                // En privé : message simple sans mention
                caption = `💫 ${reaction.verb} en GIF !`;
                mentions = [];
            }
        }
        // ==============================

        // Envoyer le GIF avec la légende appropriée
        await socket.sendMessage(sender, {
            video: { url: gif.url },
            gifPlayback: true,
            caption,
            mentions
        }, { quoted: msg });

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
