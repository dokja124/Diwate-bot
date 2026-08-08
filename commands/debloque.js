/**
 * debloque.js — Commande .debloque : autorise à nouveau un utilisateur
 * précédemment bloqué à utiliser les fonctions du bot.
 * ---------------------------------------------------------------
 * S'appuie sur le stockage partagé (blocked.json) géré dans bloque.js.
 *
 * Voir bloque.js pour les instructions d'intégration complètes dans pair.js.
 */

const { unblockUser, isBlocked, resolveTarget } = require('./bloque');

/**
 * Gère la commande .debloque (réservée au propriétaire du bot).
 */
async function handleDebloque(socket, msg, sender, isGroup, nowsender, isOwner, fakevCard, args = []) {
    if (!isOwner) {
        await socket.sendMessage(sender, {
            text: '❌ *Seul le propriétaire du bot peut utiliser cette commande.*'
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }

    const target = resolveTarget(msg, args);
    if (!target) {
        await socket.sendMessage(sender, {
            text: '❌ *Réponds au message de la personne à débloquer avec .debloque* (ou mentionne-la / donne son numéro).'
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }

    if (!isBlocked(target)) {
        await socket.sendMessage(sender, {
            text: `ℹ️ *@${target.split('@')[0]} n'est pas bloqué.*`,
            mentions: [target]
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }

    unblockUser(target);

    await socket.sendMessage(sender, {
        text: `✅ *Utilisateur débloqué*\n\n@${target.split('@')[0]} peut à nouveau utiliser les commandes du bot.`,
        mentions: [target]
    }, { quoted: fakevCard || msg }).catch(() => {});
    return true;
}

module.exports = { handleDebloque };
