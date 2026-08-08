/**
 * addproprio.js — Commande ".add proprio" : donne à une personne le même
 * niveau d'accès que le propriétaire du bot (second propriétaire).
 * ---------------------------------------------------------------
 * ⚠️ IMPORTANT : cette commande n'est utilisable QUE par le vrai
 * propriétaire d'origine (celui défini dans config.OWNER_NUMBER, ou le
 * bot lui-même). Un second propriétaire ajouté via cette commande ne
 * pourra JAMAIS utiliser .add proprio ni .del proprio, même s'il a accès
 * à toutes les autres commandes réservées au propriétaire.
 *
 * La liste des seconds propriétaires est stockée dans proprios.json (à
 * la racine du projet), pour survivre aux redémarrages du bot.
 *
 * Comment l'intégrer dans pair.js :
 * ----------------------------------
 * 1. En haut de pair.js, ajoute :
 *      const { handleAddProprio, isSecondaryOwner } = require('./addproprio');
 *      const { handleDelProprio } = require('./delproprio');
 *
 * 2. Remplace le calcul de isOwner par ceci (garde une variable séparée
 *    isVraiProprio pour le vrai propriétaire d'origine) :
 *      const isVraiProprio = isbot ? isbot : developers.includes(senderNumber);
 *      const isOwner = isVraiProprio || isSecondaryOwner(nowsender);
 *
 * 3. Dans le switch(command), ajoute :
 *      case 'add': {
 *          if (args[0] && args[0].toLowerCase() === 'proprio') {
 *              await handleAddProprio(socket, msg, sender, nowsender, isVraiProprio, fakevCard);
 *          }
 *          break;
 *      }
 *      case 'del': {
 *          if (args[0] && args[0].toLowerCase() === 'proprio') {
 *              await handleDelProprio(socket, msg, sender, nowsender, isVraiProprio, fakevCard);
 *          }
 *          break;
 *      }
 */

const fs = require('fs-extra');
const path = require('path');

const PROPRIOS_FILE = path.join(__dirname, 'proprios.json');

// =============================================
// STOCKAGE PERSISTANT
// =============================================
function chargerProprios() {
    try {
        if (!fs.existsSync(PROPRIOS_FILE)) return [];
        return fs.readJsonSync(PROPRIOS_FILE);
    } catch (error) {
        console.error('Erreur lecture proprios.json:', error.message);
        return [];
    }
}

function sauvegarderProprios(liste) {
    try {
        fs.writeJsonSync(PROPRIOS_FILE, liste, { spaces: 2 });
    } catch (error) {
        console.error('Erreur écriture proprios.json:', error.message);
    }
}

/**
 * Vérifie si un jid est un second propriétaire (ajouté via .add proprio).
 */
function isSecondaryOwner(jid) {
    if (!jid) return false;
    return chargerProprios().includes(jid);
}

/**
 * Ajoute un jid à la liste des seconds propriétaires (s'il n'y est pas déjà).
 */
function addSecondaryOwner(jid) {
    const liste = chargerProprios();
    if (!liste.includes(jid)) {
        liste.push(jid);
        sauvegarderProprios(liste);
    }
}

/**
 * Détermine le jid de la personne visée : message cité (reply) en priorité,
 * sinon mention, sinon numéro en argument.
 */
function resolveTarget(msg, args) {
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    if (quotedParticipant) return quotedParticipant;

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (mentioned && mentioned.length > 0) return mentioned[0];

    if (args && args.length > 0) {
        const digits = args[0].replace(/[^0-9]/g, '');
        if (digits.length >= 8) return `${digits}@s.whatsapp.net`;
    }

    return null;
}

/**
 * Gère la commande .add proprio (réservée STRICTEMENT au vrai propriétaire).
 */
async function handleAddProprio(socket, msg, sender, nowsender, isVraiProprio, fakevCard, args = []) {
    if (!isVraiProprio) {
        await socket.sendMessage(sender, {
            text: '❌ *Seul le propriétaire principal du bot peut ajouter un second propriétaire.*'
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }

    const target = resolveTarget(msg, args);
    if (!target) {
        await socket.sendMessage(sender, {
            text: '❌ *Réponds au message de la personne à ajouter comme second propriétaire avec .add proprio.*'
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }

    const botNumber = socket.user.id.split(':')[0];
    if (target.split('@')[0] === botNumber) {
        await socket.sendMessage(sender, {
            text: '❌ *Le bot ne peut pas être ajouté comme second propriétaire.*'
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }

    if (isSecondaryOwner(target)) {
        await socket.sendMessage(sender, {
            text: `ℹ️ *@${target.split('@')[0]} est déjà second propriétaire.*`,
            mentions: [target]
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }

    addSecondaryOwner(target);

    await socket.sendMessage(sender, {
        text: `👑 *Nouveau second propriétaire ajouté*\n\n@${target.split('@')[0]} peut désormais utiliser toutes les commandes du bot, comme le propriétaire.\n\n⚠️ Seul le propriétaire principal peut retirer ce statut (.del proprio).`,
        mentions: [target]
    }, { quoted: fakevCard || msg }).catch(() => {});
    return true;
}

module.exports = {
    handleAddProprio,
    isSecondaryOwner,
    addSecondaryOwner,
    resolveTarget,
    chargerProprios,
    sauvegarderProprios
};
