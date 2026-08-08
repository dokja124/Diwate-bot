/**
 * rang.js — Commande .rang : envoie une carte de rang stylée avec la photo
 * de profil, le niveau, le titre et le nombre de messages de la personne.
 * ---------------------------------------------------------------
 * Le compteur de messages est stocké dans un fichier JSON (ranks.json, à
 * la racine du projet) pour survivre aux redémarrages du bot.
 *
 * Comment l'intégrer dans pair.js :
 * ----------------------------------
 * 1. En haut de pair.js, ajoute :
 *      const { handleRang, incrementMessages } = require('./rang');
 *
 * 2. Juste après avoir calculé `nowsender` (donc pour CHAQUE message, pas
 *    seulement les commandes), ajoute :
 *      incrementMessages(nowsender);
 *
 * 3. Dans le switch(command), ajoute :
 *      case 'rang': {
 *          await handleRang(socket, msg, sender, isGroup, nowsender, args, fakevCard);
 *          break;
 *      }
 */

const fs = require('fs-extra');
const path = require('path');

const RANKS_FILE = path.join(__dirname, 'ranks.json');

// =============================================
// 1. TITRES PAR PALIER DE NIVEAU
// =============================================
const TITRES = [
    { min: 1, max: 4, titre: '🌱 Débutant' },
    { min: 5, max: 9, titre: '⭐ Habitué' },
    { min: 10, max: 19, titre: '🔥 Actif' },
    { min: 20, max: 39, titre: '💎 Vétéran' },
    { min: 40, max: 69, titre: '👑 Légende' },
    { min: 70, max: Infinity, titre: '🏆 Mythique' },
];

const MESSAGES_PAR_NIVEAU = 20; // nombre de messages nécessaires pour monter d'un niveau

// =============================================
// 2. STOCKAGE PERSISTANT
// =============================================
function chargerRanks() {
    try {
        if (!fs.existsSync(RANKS_FILE)) return {};
        return fs.readJsonSync(RANKS_FILE);
    } catch (error) {
        console.error('Erreur lecture ranks.json:', error.message);
        return {};
    }
}

function sauvegarderRanks(data) {
    try {
        fs.writeJsonSync(RANKS_FILE, data, { spaces: 2 });
    } catch (error) {
        console.error('Erreur écriture ranks.json:', error.message);
    }
}

/**
 * Incrémente le compteur de messages d'un utilisateur.
 * À appeler pour CHAQUE message reçu (pas seulement les commandes).
 */
function incrementMessages(jid) {
    if (!jid) return;
    const data = chargerRanks();
    if (!data[jid]) data[jid] = { messages: 0 };
    data[jid].messages += 1;
    sauvegarderRanks(data);
}

/**
 * Récupère le nombre de messages d'un utilisateur.
 */
function getMessages(jid) {
    const data = chargerRanks();
    return data[jid]?.messages || 0;
}

// =============================================
// 3. CALCUL DU NIVEAU / TITRE / PROGRESSION
// =============================================
function calculerRang(totalMessages) {
    const niveau = Math.floor(totalMessages / MESSAGES_PAR_NIVEAU) + 1;
    const messagesDansNiveau = totalMessages % MESSAGES_PAR_NIVEAU;
    const titreInfo = TITRES.find(t => niveau >= t.min && niveau <= t.max) || TITRES[TITRES.length - 1];

    // Barre de progression (10 blocs)
    const proportion = messagesDansNiveau / MESSAGES_PAR_NIVEAU;
    const blocsRemplis = Math.round(proportion * 10);
    const barre = '█'.repeat(blocsRemplis) + '░'.repeat(10 - blocsRemplis);

    return {
        niveau,
        titre: titreInfo.titre,
        messagesDansNiveau,
        messagesRestants: MESSAGES_PAR_NIVEAU - messagesDansNiveau,
        barre,
        totalMessages
    };
}

/**
 * Détermine le jid de la personne visée (soi-même par défaut, ou la
 * personne mentionnée / dont le message est cité).
 */
function resolveTarget(msg, args, nowsender) {
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    if (quotedParticipant) return quotedParticipant;

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (mentioned && mentioned.length > 0) return mentioned[0];

    if (args.length > 0) {
        const digits = args[0].replace(/[^0-9]/g, '');
        if (digits.length >= 8) return `${digits}@s.whatsapp.net`;
    }

    return nowsender;
}

// =============================================
// 4. COMMANDE PRINCIPALE .rang
// =============================================
async function handleRang(socket, msg, sender, isGroup, nowsender, args, fakevCard) {
    try {
        const target = resolveTarget(msg, args, nowsender);
        const totalMessages = getMessages(target);
        const rang = calculerRang(totalMessages);
        const tag = `@${target.split('@')[0]}`;

        const caption = `╭───「 🏅 *CARTE DE RANG* 」───╮\n` +
            `│\n` +
            `│ 👤 *Utilisateur :* ${tag}\n` +
            `│ 🎖️ *Niveau :* ${rang.niveau}\n` +
            `│ 🏷️ *Titre :* ${rang.titre}\n` +
            `│ 💬 *Messages envoyés :* ${rang.totalMessages}\n` +
            `│\n` +
            `│ 📊 *Progression :*\n` +
            `│ ${rang.barre} ${rang.messagesDansNiveau}/${MESSAGES_PAR_NIVEAU}\n` +
            `│ ⏳ ${rang.messagesRestants} message(s) avant le niveau ${rang.niveau + 1}\n` +
            `│\n` +
            `╰──────────────────────╯`;

        // Récupération de la photo de profil (avec repli si indisponible/privée)
        let ppUrl;
        try {
            ppUrl = await socket.profilePictureUrl(target, 'image');
        } catch (e) {
            ppUrl = 'https://i.imgur.com/2wjP5D9.png'; // avatar par défaut
        }

        await socket.sendMessage(sender, {
            image: { url: ppUrl },
            caption,
            mentions: [target]
        }, { quoted: fakevCard || msg });

        return true;
    } catch (error) {
        console.error('Erreur handleRang:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur lors de l'affichage du rang :*\n${error.message}`
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }
}

module.exports = { handleRang, incrementMessages, getMessages, calculerRang };
     
