/**
 * bloque.js — Commande .bloque : empêche un utilisateur d'utiliser les
 * fonctions du bot.
 * ---------------------------------------------------------------
 * Le blocage est stocké dans un fichier JSON (blocked.json, à la racine
 * du projet) pour survivre aux redémarrages du bot.
 *
 * Comment l'intégrer dans pair.js :
 * ----------------------------------
 * 1. En haut de pair.js, ajoute :
 *      const { handleBloque, isBlocked } = require('./bloque');
 *      const { handleDebloque } = require('./debloque');
 *
 * 2. Juste après avoir calculé `nowsender` et `isOwner` (donc avant le
 *    traitement des commandes), ajoute un filtre pour ignorer les
 *    utilisateurs bloqués (sauf le propriétaire du bot) :
 *      if (!isOwner && isBlocked(nowsender)) {
 *          return;
 *      }
 *
 * 3. Dans le switch(command), ajoute :
 *      case 'bloque': {
 *          await handleBloque(socket, msg, sender, isGroup, nowsender, isOwner, fakevCard);
 *          break;
 *      }
 *      case 'debloque': {
 *          await handleDebloque(socket, msg, sender, isGroup, nowsender, isOwner, fakevCard);
 *          break;
 *      }
 */

const fs = require('fs-extra');
const path = require('path');

const BLOCKED_FILE = path.join(__dirname, 'blocked.json');

/**
 * Charge la liste des jid bloqués depuis le disque.
 */
function loadBlocked() {
    try {
        if (!fs.existsSync(BLOCKED_FILE)) return [];
        return fs.readJsonSync(BLOCKED_FILE);
    } catch (error) {
        console.error('Erreur lecture blocked.json:', error.message);
        return [];
    }
}

/**
 * Sauvegarde la liste des jid bloqués sur le disque.
 */
function saveBlocked(liste) {
    try {
        fs.writeJsonSync(BLOCKED_FILE, liste, { spaces: 2 });
    } catch (error) {
        console.error('Erreur écriture blocked.json:', error.message);
    }
}

/**
 * Vérifie si un jid est bloqué.
 */
function isBlocked(jid) {
    if (!jid) return false;
    const liste = loadBlocked();
    return liste.includes(jid);
}

/**
 * Ajoute un jid à la liste des bloqués (s'il n'y est pas déjà).
 */
function blockUser(jid) {
    const liste = loadBlocked();
    if (!liste.includes(jid)) {
        liste.push(jid);
        saveBlocked(liste);
    }
}

/**
 * Retire un jid de la liste des bloqués.
 */
function unblockUser(jid) {
    const liste = loadBlocked();
    const nouvelleListe = liste.filter(j => j !== jid);
    saveBlocked(nouvelleListe);
}

/**
 * Détermine le jid de la personne visée par la commande :
 * 1. Le participant du message cité (reply) — méthode principale
 * 2. Une mention (@numéro) dans le message
 * 3. Un numéro passé en argument (ex: .bloque 225xxxxxxx)
 * Retourne null si aucune cible n'est trouvée.
 */
function resolveTarget(msg, args) {
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    if (quotedParticipant) return quotedParticipant;

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (mentioned && mentioned.length > 0) return mentioned[0];

    if (args.length > 0) {
        const digits = args[0].replace(/[^0-9]/g, '');
        if (digits.length >= 8) return `${digits}@s.whatsapp.net`;
    }

    return null;
}

/**
 * Gère la commande .bloque (réservée au propriétaire du bot).
 */
async function handleBloque(socket, msg, sender, isGroup, nowsender, isOwner, fakevCard, args = []) {
    if (!isOwner) {
        await socket.sendMessage(sender, {
            text: '❌ *Seul le propriétaire du bot peut utiliser cette commande.*'
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }

    const target = resolveTarget(msg, args);
    if (!target) {
        await socket.sendMessage(sender, {
            text: '❌ *Réponds au message de la personne à bloquer avec .bloque* (ou mentionne-la / donne son numéro).'
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }

    const botNumber = socket.user.id.split(':')[0];
    if (target.split('@')[0] === botNumber) {
        await socket.sendMessage(sender, {
            text: '❌ *Impossible de bloquer le bot lui-même.*'
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }

    blockUser(target);

    await socket.sendMessage(sender, {
        text: `🚫 *Utilisateur bloqué*\n\n@${target.split('@')[0]} ne peut plus utiliser les commandes du bot.`,
        mentions: [target]
    }, { quoted: fakevCard || msg }).catch(() => {});
    return true;
}

module.exports = { handleBloque, isBlocked, blockUser, unblockUser, resolveTarget };
