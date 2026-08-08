/**
 * info.js — Commande .info : affiche les informations réellement
 * disponibles sur un contact (photo de profil, statut "à propos" s'il
 * est public, numéro, rôle dans le groupe...).
 * ---------------------------------------------------------------
 * Contrairement à un "traqueur", cette commande n'affiche QUE des
 * données réelles renvoyées par l'API WhatsApp — jamais de données
 * inventées (pas de batterie, pas de localisation, pas de "statut en
 * ligne" simulé). Si une info n'est pas disponible ou privée, elle est
 * clairement indiquée comme telle.
 *
 * Comment l'intégrer dans pair.js :
 * ----------------------------------
 * 1. En haut de pair.js, ajoute :
 *      const { handleInfo } = require('./info');
 *
 * 2. Dans le switch(command), ajoute :
 *      case 'info': {
 *          await handleInfo(socket, msg, sender, isGroup, nowsender, fakevCard, args);
 *          break;
 *      }
 */

/**
 * Détermine le jid de la personne visée : message cité (reply) en
 * priorité, sinon mention, sinon numéro en argument, sinon soi-même.
 */
function resolveTarget(msg, args, nowsender) {
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    if (quotedParticipant) return quotedParticipant;

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (mentioned && mentioned.length > 0) return mentioned[0];

    if (args && args.length > 0) {
        const digits = args[0].replace(/[^0-9]/g, '');
        if (digits.length >= 8) return `${digits}@s.whatsapp.net`;
    }

    return nowsender;
}

async function handleInfo(socket, msg, sender, isGroup, nowsender, fakevCard, args = []) {
    try {
        const target = resolveTarget(msg, args, nowsender);
        const numero = target.split('@')[0];

        await socket.sendMessage(sender, { react: { text: '🔎', key: msg.key } }).catch(() => {});

        // --- Photo de profil (réelle, ou "non disponible" si privée/absente) ---
        let ppUrl = null;
        try {
            ppUrl = await socket.profilePictureUrl(target, 'image');
        } catch (e) {
            ppUrl = null;
        }

        // --- Statut "à propos" (réel, si visible publiquement) ---
        let statut = 'Non disponible (privé ou non défini)';
        try {
            const infosStatut = await socket.fetchStatus(target);
            if (infosStatut?.status) {
                statut = infosStatut.status;
            }
        } catch (e) {
            // statut privé ou indisponible -> on garde le message par défaut
        }

        // --- Vérification que le numéro existe bien sur WhatsApp ---
        let existeSurWhatsApp = 'Inconnu';
        try {
            const resultats = await socket.onWhatsApp(target);
            if (resultats && resultats.length > 0) {
                existeSurWhatsApp = resultats[0].exists ? '✅ Oui' : '❌ Non';
            }
        } catch (e) {
            // indisponible
        }

        // --- Rôle dans le groupe (si applicable) ---
        let roleGroupe = null;
        let nomAffichage = null;
        if (isGroup) {
            try {
                const groupMeta = await socket.groupMetadata(msg.key.remoteJid);
                const participant = groupMeta.participants.find(p => p.id === target);
                if (participant) {
                    nomAffichage = participant.name || null;
                    if (participant.admin === 'superadmin') roleGroupe = '👑 Créateur du groupe';
                    else if (participant.admin === 'admin') roleGroupe = '🛡️ Administrateur';
                    else roleGroupe = '👤 Membre';
                }
            } catch (e) {
                // pas accessible
            }
        }

        const lignes = [
            `🔎 *INFORMATIONS CONTACT*`,
            ``,
            `👤 *Numéro :* @${numero}`,
        ];
        if (nomAffichage) lignes.push(`🏷️ *Nom affiché :* ${nomAffichage}`);
        lignes.push(`📶 *Sur WhatsApp :* ${existeSurWhatsApp}`);
        lignes.push(`💬 *À propos :* ${statut}`);
        if (roleGroupe) lignes.push(`🏅 *Rôle dans ce groupe :* ${roleGroupe}`);
        lignes.push(``);
        lignes.push(`ℹ️ _Seules les informations publiquement visibles sur WhatsApp sont affichées._`);

        const caption = lignes.join('\n');

        if (ppUrl) {
            await socket.sendMessage(sender, {
                image: { url: ppUrl },
                caption,
                mentions: [target]
            }, { quoted: fakevCard || msg });
        } else {
            await socket.sendMessage(sender, {
                text: caption + `\n\n🖼️ _Photo de profil non disponible (privée ou absente)._`,
                mentions: [target]
            }, { quoted: fakevCard || msg });
        }

        return true;
    } catch (error) {
        console.error('Erreur handleInfo:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur lors de la récupération des informations :*\n${error.message}`
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }
}

module.exports = { handleInfo };
