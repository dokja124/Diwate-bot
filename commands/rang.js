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

/**
 * Normalise un jid en retirant le suffixe technique de device (ex: ":12")
 * que WhatsApp ajoute parfois. Sans ça, une même personne peut être comptée
 * comme plusieurs utilisateurs différents (niveau/messages faussés) et le
 * numéro affiché peut contenir des caractères en trop.
 */
function normaliserJid(jid) {
    if (!jid) return jid;
    const [user, domaine] = jid.split('@');
    const numeroPropre = user.split(':')[0];
    return `${numeroPropre}@${domaine}`;
}

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
    jid = normaliserJid(jid);
    const data = chargerRanks();
    if (!data[jid]) data[jid] = { messages: 0 };
    data[jid].messages += 1;
    sauvegarderRanks(data);
}

/**
 * Récupère le nombre de messages d'un utilisateur.
 */
function getMessages(jid) {
    jid = normaliserJid(jid);
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
    if (quotedParticipant) return normaliserJid(quotedParticipant);

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (mentioned && mentioned.length > 0) return normaliserJid(mentioned[0]);

    if (args.length > 0) {
        const digits = args[0].replace(/[^0-9]/g, '');
        if (digits.length >= 8) return `${digits}@s.whatsapp.net`;
    }

    return normaliserJid(nowsender);
}

/**
 * Tente de récupérer le vrai nom affiché de la cible, du mieux possible :
 * 1. Dans un groupe : le nom du participant (si WhatsApp le fournit)
 * 2. Si la cible est l'auteur du message lui-même : son pushName (nom
 *    qu'il a défini sur WhatsApp, toujours fourni avec ses messages)
 * 3. Sinon : non disponible
 */
async function getNomAffichage(socket, msg, target, nowsender, isGroup) {
    if (isGroup) {
        try {
            const groupMeta = await socket.groupMetadata(msg.key.remoteJid);
            const participant = groupMeta.participants.find(p => p.id === target);
            const nom = participant?.name || participant?.notify || participant?.verifiedName;
            if (nom) return nom;
        } catch (e) {
            // pas accessible, on continue avec les autres méthodes
        }
    }

    if (target === nowsender && msg.pushName) {
        return msg.pushName;
    }

    return null;
}

/**
 * Détermine le rôle dans le groupe (si applicable).
 */
async function getRoleGroupe(socket, msg, target, isGroup) {
    if (!isGroup) return null;
    try {
        const groupMeta = await socket.groupMetadata(msg.key.remoteJid);
        const participant = groupMeta.participants.find(p => p.id === target);
        if (!participant) return null;
        if (participant.admin === 'superadmin') return '👑 Créateur du groupe';
        if (participant.admin === 'admin') return '🛡️ Administrateur';
        return '👤 Membre';
    } catch (e) {
        return null;
    }
}

// =============================================
// 4. COMMANDE PRINCIPALE .rang
// =============================================
async function handleRang(socket, msg, sender, isGroup, nowsender, args, fakevCard) {
    try {
        const target = resolveTarget(msg, args, nowsender);
        const totalMessages = getMessages(target);
        const rang = calculerRang(totalMessages);
        const numeroPropre = target.split('@')[0];
        const tag = `@${numeroPropre}`;

        const nomAffichage = await getNomAffichage(socket, msg, target, nowsender, isGroup);
        const roleGroupe = await getRoleGroupe(socket, msg, target, isGroup);

        const lignes = [
            `╭─✧「 🏅 *RANG* 🏅 」✧─╮`,
            `│`,                               
        ];
        if (nomAffichage) lignes.push(`│ 😎 *Nom :* ${nomAffichage}`);
        lignes.push(`│ 👤 *Utilisateur :* ${tag}`);
        if (roleGroupe) lignes.push(`│ 🏅 *Rôle :* ${roleGroupe}`);
        lignes.push(`│`);
        lignes.push(`│ 🎖️ *Niveau :* ${rang.niveau}`);
        lignes.push(`│ 🏷️ *Titre :* ${rang.titre}`);
        lignes.push(`│ 💬 *Messages envoyés :* ${rang.totalMessages}`);
        lignes.push(`│`);
        lignes.push(`│ 📊 *Progres vers le niveau ${rang.niveau + 1} :*`);
        lignes.push(`│ ${rang.barre}  ${rang.messagesDansNiveau}/${MESSAGES_PAR_NIVEAU}`);
        lignes.push(`│ ⏳ *Encore ${rang.messagesRestants} message(s) !*`);
        lignes.push(`│`);
        lignes.push(`╰──────────✧──────────╯`);

        const caption = lignes.join('\n');

        // Récupération de la photo de profil (repli en texte simple si indisponible/privée,
        // au lieu d'un lien externe qui pourrait être cassé et faire échouer tout l'envoi)
        let ppUrl = null;
        try {
            ppUrl = await socket.profilePictureUrl(target, 'image');
        } catch (e) {
            ppUrl = null;
        }

        if (ppUrl) {
            await socket.sendMessage(sender,{ react: { text: '✨', key: msg.key } }).catch(() => {}); {
                image: { url: ppUrl },
                caption,
                mentions: [target]
            }, { quoted: fakevCard || msg });
        } else {
            await socket.sendMessage(sender, {
                text: caption + `\n\n🖼️ _Photo de profil non disponible._`,
                mentions: [target]
            }, { quoted: fakevCard || msg });
        }

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
        
