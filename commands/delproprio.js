/**
 * delproprio.js — Commande ".del proprio" : retire à une personne le
 * statut de second propriétaire (ajouté via .add proprio).
 * ---------------------------------------------------------------
 * ⚠️ IMPORTANT : cette commande n'est utilisable QUE par le vrai
 * propriétaire d'origine — pas même par un second propriétaire.
 *
 * Voir addproprio.js pour le format de stockage et les instructions
 * d'intégration complètes dans pair.js.
 */

const { isSecondaryOwner, resolveTarget, chargerProprios, sauvegarderProprios } = require('./addproprio');

/**
 * Retire un jid de la liste des seconds propriétaires.
 */
function removeSecondaryOwner(jid) {
    const liste = chargerProprios();
    const nouvelleListe = liste.filter(j => j !== jid);
    sauvegarderProprios(nouvelleListe);
}

/**
 * Gère la commande .del proprio (réservée STRICTEMENT au vrai propriétaire).
 */
async function handleDelProprio(socket, msg, sender, nowsender, isVraiProprio, fakevCard, args = []) {
    if (!isVraiProprio) {
        await socket.sendMessage(sender, {
            text: '❌ *Seul le propriétaire principal du bot peut retirer un second propriétaire.*'
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }

    const target = resolveTarget(msg, args);
    if (!target) {
        await socket.sendMessage(sender, {
            text: '❌ *Réponds au message de la personne à retirer avec .del proprio.*'
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }

    if (!isSecondaryOwner(target)) {
        await socket.sendMessage(sender, {
            text: `ℹ️ *@${target.split('@')[0]} n'est pas second propriétaire.*`,
            mentions: [target]
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }

    removeSecondaryOwner(target);

    await socket.sendMessage(sender, {
        text: `🔻 *Statut de second propriétaire retiré*\n\n@${target.split('@')[0]} ne peut plus utiliser les commandes réservées au propriétaire.`,
        mentions: [target]
    }, { quoted: fakevCard || msg }).catch(() => {});
    return true;
}

module.exports = { handleDelProprio, removeSecondaryOwner };
