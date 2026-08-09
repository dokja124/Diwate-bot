/**
 * purge.js — Commande .purge : supprime tous les membres d'un groupe un par un.
 * Seul le propriétaire du bot peut exécuter cette commande.
 * Le bot doit être ADMIN du groupe.
 *
 * Comment l'intégrer dans pair.js :
 * ----------------------------------
 * 1. En haut de pair.js, ajoute :
 *      const { handlePurge } = require('./purge');
 *
 * 2. Dans le switch(command), ajoute :
 *      case 'purge': {
 *          await handlePurge(socket, msg, sender, isGroup, nowsender, isOwner, fakevCard, args);
 *          break;
 *      }
 */

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Vérifie si le bot est admin du groupe.
 * Compare uniquement la partie "numéro" (avant @ et avant :), pour rester
 * robuste face aux identifiants LID que WhatsApp utilise de plus en plus
 * dans les listes de participants (au lieu du numéro classique).
 */
async function isBotAdmin(socket, groupId) {
    try {
        const groupMeta = await socket.groupMetadata(groupId);
        const botNumber = socket.user.id.split('@')[0].split(':')[0];
        const participant = groupMeta.participants.find(p => {
            const pNumber = p.id.split('@')[0].split(':')[0];
            return pNumber === botNumber;
        });
        return participant?.admin === 'admin' || participant?.admin === 'superadmin';
    } catch (error) {
        console.error('Erreur vérification admin:', error.message);
        return null; // null = impossible à vérifier (différent de false = pas admin)
    }
}

/**
 * Récupère tous les participants du groupe sauf le bot et la personne
 * qui a lancé la commande (protégée pour ne pas s'auto-exclure).
 */
async function getParticipantsToRemove(socket, groupId, nowsender) {
    try {
        const groupMeta = await socket.groupMetadata(groupId);
        const botNumber = socket.user.id.split('@')[0].split(':')[0];
        const senderNumber = (nowsender || '').split('@')[0].split(':')[0];

        return groupMeta.participants
            .filter(p => {
                const pNumber = p.id.split('@')[0].split(':')[0];
                return pNumber !== botNumber && pNumber !== senderNumber;
            })
            .map(p => p.id);
    } catch (error) {
        console.error('Erreur récupération participants:', error.message);
        return [];
    }
}

/**
 * Supprime un participant du groupe
 */
async function removeParticipant(socket, groupId, participantId) {
    try {
        await socket.groupParticipantsUpdate(groupId, [participantId], 'remove');
        return true;
    } catch (error) {
        console.error(`Erreur suppression ${participantId}:`, error.message);
        return false;
    }
}

// =============================================
// COMMANDE PRINCIPALE .purge
// =============================================
async function handlePurge(socket, msg, sender, isGroup, nowsender, isOwner, fakevCard, args = []) {
    try {
        // 1. Vérifier que c'est un groupe
        if (!isGroup) {
            await socket.sendMessage(sender, {
                text: '❌ *Cette commande ne peut être utilisée que dans un groupe.*'
            }, { quoted: fakevCard || msg });
            return true;
        }

        // 2. Vérifier que l'utilisateur est le propriétaire
        if (!isOwner) {
            await socket.sendMessage(sender, {
                text: '❌ *Seul le propriétaire du bot peut utiliser cette commande.*'
            }, { quoted: fakevCard || msg }).catch(() => {});
            return true;
        }

        // 3. Vérifier que le bot est admin (avertissement seulement si indétectable,
        // ne bloque pas : la vraie confirmation vient de l'appel API lui-même à l'étape 8)
        const groupId = msg.key.remoteJid;
        const botIsAdmin = await isBotAdmin(socket, groupId);
        if (botIsAdmin === false) {
            await socket.sendMessage(sender, {
                text: '❌ *Le bot doit être administrateur du groupe pour utiliser cette commande.*'
            }, { quoted: fakevCard || msg });
            return true;
        }

        // 4. Demander confirmation
        const participants = await getParticipantsToRemove(socket, groupId, nowsender);
        if (participants.length === 0) {
            await socket.sendMessage(sender, {
                text: '✅ *Aucun membre à supprimer.*\n(Le bot et toi êtes protégés)'
            }, { quoted: fakevCard || msg });
            return true;
        }

        // 5. Vérifier la confirmation (args[0], car "confirm" est le 1er mot après la commande)
        const confirmArg = args[0]?.toLowerCase();
        if (confirmArg !== 'confirm') {
            await socket.sendMessage(sender, {
                text: `⚠️ *CONFIRMATION REQUISE*\n\nTu t'apprêtes à supprimer *${participants.length}* membre(s) du groupe.\n\n✅ Pour confirmer, tape :\n\`.purge confirm\``
            }, { quoted: fakevCard || msg });
            return true;
        }

        // 6. Envoyer un message de début
        await socket.sendMessage(sender, {
            text: `🔄 *Début de la purge...*\nSuppression de ${participants.length} membre(s)...`
        }, { quoted: fakevCard || msg });

        // 7. Supprimer les membres un par un
        let successCount = 0;
        let failCount = 0;
        const total = participants.length;

        for (let i = 0; i < total; i++) {
            const participant = participants[i];
            const removed = await removeParticipant(socket, groupId, participant);

            if (removed) successCount++;
            else failCount++;

            if ((i + 1) % 5 === 0 || i === total - 1) {
                await socket.sendMessage(sender, {
                    text: `📊 *Progression :* ${i + 1}/${total}\n✅ Réussis : ${successCount}\n❌ Échecs : ${failCount}`
                }, { quoted: fakevCard || msg });
            }

            await sleep(500); // évite les rate limits WhatsApp
        }

        // Si tout a échoué, le bot n'était probablement pas réellement admin
        const messageFinal = successCount === 0 && failCount === total
            ? `⚠️ *Purge terminée, mais 0 suppression n'a réussi.*\n\nLe bot n'est probablement pas réellement administrateur du groupe (vérifie ses permissions dans les paramètres du groupe).`
            : `✅ *Purge terminée !*\n\n👥 Membres supprimés : ${successCount}\n❌ Échecs : ${failCount}\n📊 Total : ${total}\n\n🛡️ *Le bot et toi avez été préservés.*`;

        await socket.sendMessage(sender, { text: messageFinal }, { quoted: fakevCard || msg });

        return true;
    } catch (error) {
        console.error('Erreur handlePurge:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur lors du purge :*\n${error.message}`
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }
}

module.exports = { handlePurge };
                    
