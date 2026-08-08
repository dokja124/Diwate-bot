/**
 * rang.js — Commande .rang : envoie une carte de rang stylée avec la photo
 * de profil, le niveau, le titre et le nombre de messages de la personne.
 * ---------------------------------------------------------------
 * Le compteur de messages est stocké dans un fichier JSON (ranks.json, à
 * la racine du projet) pour survivre aux redémarrages du bot.
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

const MESSAGES_PAR_NIVEAU = 20;

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

// =============================================
// 4. RÉSOLUTION DU TARGET (CORRIGÉ)
// =============================================
function resolveTarget(msg, args, sender) {
    // 1. Vérifier si un message est cité (réponse)
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo;
    if (quotedMsg) {
        // Si le message cité vient d'un groupe, prendre le participant
        if (quotedMsg.participant) {
            return quotedMsg.participant;
        }
        // Sinon prendre l'expéditeur du message cité
        if (quotedMsg.mentionedJid && quotedMsg.mentionedJid.length > 0) {
            return quotedMsg.mentionedJid[0];
        }
    }

    // 2. Vérifier les mentions dans le message
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (mentionedJid && mentionedJid.length > 0) {
        return mentionedJid[0];
    }

    // 3. Vérifier si un numéro est passé en argument
    if (args && args.length > 0) {
        const arg = args[0];
        // Si c'est une mention directe (@numero)
        if (arg.startsWith('@')) {
            const number = arg.replace('@', '').replace(/[^0-9]/g, '');
            if (number.length >= 8) {
                return `${number}@s.whatsapp.net`;
            }
        }
        // Si c'est un numéro de téléphone
        const digits = arg.replace(/[^0-9]/g, '');
        if (digits.length >= 8) {
            // Vérifier si c'est un numéro international
            if (digits.startsWith('0')) {
                return `${digits}@s.whatsapp.net`;
            }
            return `${digits}@s.whatsapp.net`;
        }
    }

    // 4. Par défaut, retourner l'expéditeur
    return sender;
}

// =============================================
// 5. COMMANDE PRINCIPALE .rang (AMÉLIORÉE)
// =============================================
async function handleRang(socket, msg, sender, isGroup, nowsender, args, fakevCard) {
    try {
        // Résoudre la cible avec plus de précision
        let target = resolveTarget(msg, args, sender);
        
        console.log(`🔍 Target résolu: ${target}`);
        console.log(`📝 Arguments: ${args}`);
        
        // Si c'est un groupe et que la cible n'a pas @s.whatsapp.net, la corriger
        if (isGroup && !target.includes('@')) {
            target = `${target}@s.whatsapp.net`;
        }

        // Vérifier si l'utilisateur existe dans la base de données
        const totalMessages = getMessages(target);
        
        // Si l'utilisateur n'a jamais envoyé de message, on lui crée une entrée
        if (totalMessages === 0 && target !== sender) {
            // Créer une entrée avec 0 message pour afficher "nouveau membre"
            const data = chargerRanks();
            if (!data[target]) {
                data[target] = { messages: 0 };
                sauvegarderRanks(data);
            }
        }

        const rang = calculerRang(totalMessages);
        
        // Extraire le nom d'utilisateur pour l'affichage
        const username = target.split('@')[0];
        const tag = `@${username}`;

        // Construire le message
        const caption = `╭───「 🏅 *CARTE DE RANG* 」───╮\n` +
            `│\n` +
            `│ 👤 *Utilisateur :* ${tag}\n` +
            `│ 🎖️ *Niveau :* ${rang.niveau}\n` +
            `│ 🏷️ *Titre :* ${rang.titre}\n` +
            `│ 💬 *Messages :* ${rang.totalMessages}\n` +
            `│\n` +
            `│ 📊 *Progression :*\n` +
            `│ ${rang.barre} ${rang.messagesDansNiveau}/${MESSAGES_PAR_NIVEAU}\n` +
            `│ ⏳ ${rang.messagesRestants} msg avant niveau ${rang.niveau + 1}\n` +
            `│\n` +
            `╰──────────────────────╯`;

        // Récupération de la photo de profil
        let ppUrl;
        try {
            ppUrl = await socket.profilePictureUrl(target, 'image');
        } catch (e) {
            console.log(`⚠️ Pas de photo de profil pour ${target}`);
            ppUrl = 'https://i.imgur.com/2wjP5D9.png';
        }

        // Envoyer le message
        await socket.sendMessage(
            sender, 
            {
                image: { url: ppUrl },
                caption: caption,
                mentions: [target]
            },
            { quoted: fakevCard || msg }
        );

        return true;

    } catch (error) {
        console.error('❌ Erreur handleRang:', error);
        await socket.sendMessage(
            sender,
            {
                text: `❌ *Erreur lors de l'affichage du rang :*\n\`\`\`${error.message}\`\`\`\n\nVérifiez que vous utilisez bien la commande correctement.`
            },
            { quoted: fakevCard || msg }
        ).catch(() => {});
        return false;
    }
}

// =============================================
// 6. EXPORTS
// =============================================
module.exports = { 
    handleRang, 
    incrementMessages, 
    getMessages, 
    calculerRang,
    resolveTarget 
};
