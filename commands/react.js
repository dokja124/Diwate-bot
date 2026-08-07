/**
 * react.js — Commandes de réaction (gifs anime) via l'API nekos.best
 * ---------------------------------------------------------------
 * API utilisée : https://nekos.best/api/v2/<catégorie>
 * (100% SFW, gratuite, sans clé API)
 *
 * Comment l'intégrer dans pair.js :
 * ----------------------------------
 * 1. En haut de pair.js, ajoute :
 *      const { REACTIONS, handleReaction } = require('./react');
 *
 * 2. Dans setupCommandHandlers(), juste après la ligne :
 *      if (!command) return;
 *    ajoute :
 *      if (REACTIONS[command]) {
 *          await handleReaction(socket, msg, sender, isGroup, command, args, nowsender);
 *          return;
 *      }
 *
 * C'est tout : les 15 commandes ci-dessous fonctionneront automatiquement,
 * sans toucher au gros switch/case existant.
 */

const axios = require('axios');

// Commande (en français) -> { endpoint nekos.best, verbe utilisé dans le texte }
const REACTIONS = {
    gifle:    { endpoint: 'slap',   verb: 'gifle' },
    tape:     { endpoint: 'punch',  verb: 'frappe' },
    boum:     { endpoint: 'kick',   verb: 'donne un coup de pied à' },
    tue:      { endpoint: 'shoot',  verb: 'tire sur' },
    calin:    { endpoint: 'hug',    verb: 'fait un câlin à' },
    blottis:  { endpoint: 'cuddle', verb: 'se blottit contre' },
    bisou:    { endpoint: 'kiss',   verb: 'embrasse' },
    embrasse: { endpoint: 'kiss',   verb: 'embrasse' },
    caresse:  { endpoint: 'pat',    verb: 'caresse' },
    titille:  { endpoint: 'tickle', verb: 'chatouille' },
    mordre:   { endpoint: 'bite',   verb: 'mord' },
    envoie:   { endpoint: 'yeet',   verb: 'envoie valser' },
    danse:    { endpoint: 'dance',  verb: 'danse avec' },
    clin:     { endpoint: 'wink',   verb: 'fait un clin d\'œil à' },
    sourire:  { endpoint: 'smile',  verb: 'sourit à' },
    coucou:   { endpoint: 'wave',   verb: 'salue' },
    triste:   { endpoint: 'cry',    verb: 'pleure devant' },
    dodo:     { endpoint: 'sleep',  verb: 's\'endort avec' },
    content:  { endpoint: 'happy',  verb: 'est content(e) avec' },
};

/**
 * Récupère un gif aléatoire depuis nekos.best pour une catégorie donnée.
 */
async function fetchNekoGif(endpoint) {
    const { data } = await axios.get(`https://nekos.best/api/v2/${endpoint}`, {
        timeout: 10000
    });
    const result = data?.results?.[0];
    if (!result?.url) throw new Error(`Aucun résultat pour la catégorie "${endpoint}"`);
    return result;
}

/**
 * Détermine le jid de la personne visée par la réaction :
 * 1. Une mention (@numéro) dans le message
 * 2. Le participant du message cité (reply)
 * 3. Un numéro passé en argument (ex: .gifle 225xxxxxxx)
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
        // Petit accusé de réception sous forme d'emoji
        await socket.sendMessage(sender, { react: { text: '💫', key: msg.key } }).catch(() => {});

        const gif = await fetchNekoGif(reaction.endpoint);
        const target = resolveTarget(msg, args);
        const authorTag = `@${(nowsender || sender).split('@')[0]}`;

        let caption;
        let mentions = [nowsender].filter(Boolean);

        if (target) {
            const targetTag = `@${target.split('@')[0]}`;
            caption = `${authorTag} ${reaction.verb} ${targetTag} !`;
            mentions.push(target);
        } else {
            caption = `${authorTag} ${reaction.verb} tout le monde ! 😄`;
        }

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

module.exports = { REACTIONS, handleReaction, fetchNekoGif };
  
