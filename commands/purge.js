/**
 * kickall.js — Commande .kickall : supprime tous les membres du groupe un par un.
 * Seul le propriétaire du bot peut exécuter cette commande.
 * Le bot doit être ADMIN du groupe.
 * 
 * Comment l'intégrer dans pair.js :
 * ----------------------------------
 * 1. En haut de pair.js, ajoute :
 *      const { handleKickall } = require('./kickall');
 * 
 * 2. Dans le switch(command), ajoute :
 *      case 'kickall': {
 *          await handleKickall(socket, msg, sender, isGroup, args, fakevCard, isOwner);
 *          break;
 *      }
 */

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Vérifie si le bot est admin du groupe
 */
async function isBotAdmin(socket, groupId) {
    try {
        const groupMeta = await socket.groupMetadata(groupId);
        const botJid = socket.user.id.split(':')[0] + '@s.whatsapp.net';
        const participant = groupMeta.participants.find(p => p.id === botJid);
        return participant?.admin === 'admin' || participant?.admin === 'superadmin';
    } catch (error) {
        console.error('Erreur vérification admin:', error.message);
        return false;
    }
}

/**
 * Récupère tous les participants du groupe sauf le bot et le propriétaire
 */
async function getParticipantsToKick(socket, groupId, ownerNumber) {
    try {
        const groupMeta = await socket.groupMetadata(groupId);
        const botJid = socket.user.id.split(':')[0] + '@s.whatsapp.net';
        const ownerClean = ownerNumber.split('@')[0].replace(/[^0-9]/g, '');

        return groupMeta.participants
            .filter(p => {
                const pClean = p.id.split('@')[0].replace(/[^0-9]/g, '');
                return p.id !== botJid && pClean !== ownerClean;
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
async function kickParticipant(socket, groupId, participantId) {
    try {
        await socket.groupParticipantsUpdate(groupId, [participantId], 'remove');
        return true;
    } catch (error) {
        console.error(`Erreur suppression ${participantId}:`, error.message);
        return false;
    }
}

// =============================================
// COMMANDE PRINCIPALE .kickall
// =============================================
async function handlePurge(socket, msg, sender, isGroup, args, fakevCard, isOwner, botIsAdmin) {
    try {
        // ✅ Réaction
        await socket.sendMessage(sender, { react: { text: '😈', key: msg.key } }).catch(() => {});

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

        // 3. Vérifier que le bot est admin
        const groupId = msg.key.remoteJid;
        const botIsAdmin = await isBotAdmin(socket, groupId);
        if (!botIsAdmin) {
            await socket.sendMessage(sender, {
                text: '❌ *Le bot doit être administrateur du groupe pour utiliser cette commande.*'
            }, { quoted: fakevCard || msg });
            return true;
        }

        // 4. Récupérer le numéro du propriétaire
        const ownerNumber = config.OWNER_NUMBER + '@s.whatsapp.net';
        const participants = await getParticipantsToKick(socket, groupId, ownerNumber);
        
        if (participants.length === 0) {
            await socket.sendMessage(sender, {
                text: '✅ *Aucun membre à expulser.*\n(Le bot et le propriétaire sont protégés)'
            }, { quoted: fakevCard || msg });
            return true;
        }

        // 5. Confirmation
        await socket.sendMessage(sender, {
            text: `⚠️ *CONFIRMATION REQUISE*\n\nTu t'apprêtes à expulser *${participants.length}* membre(s) du groupe.\n\n✅ Pour confirmer, tape :\n\`${args[0] || '.'}kickall confirm\``
        }, { quoted: fakevCard || msg });

        // 6. Vérifier la confirmation
        const confirmArg = args[1]?.toLowerCase();
        if (confirmArg !== 'confirm') {
            return true;
        }

        // 7. Début de l'expulsion
        await socket.sendMessage(sender, {
            text: `🔄 *Début de la purge...*\nSuppression de ${participants.length} membre(s)...`
        }, { quoted: fakevCard || msg });

        // 8. Expulser les membres
        let successCount = 0;
        let failCount = 0;
        const total = participants.length;

        for (let i = 0; i < total; i++) {
            const participant = participants[i];
            const removed = await kickParticipant(socket, groupId, participant);

            if (removed) {
                successCount++;
            } else {
                failCount++;
            }

            // Afficher la progression toutes les 5 expulsions
            if ((i + 1) % 5 === 0 || i === total - 1) {
                await socket.sendMessage(sender, {
                    text: `📊 *Progression :* ${i + 1}/${total}\n✅ Réussis : ${successCount}\n❌ Échecs : ${failCount}`
                }, { quoted: fakevCard || msg });
            }

            // Pause de 800ms pour éviter les rate limits
            await sleep(800);
        }

        // 9. Message final
        await socket.sendMessage(sender, {
            text: `✅ *Expulsion terminée !*\n\n👥 Membres expulsés : ${successCount}\n❌ Échecs : ${failCount}\n📊 Total : ${total}\n\n🛡️ *Le bot et le propriétaire ont été préservés.*`
        }, { quoted: fakevCard || msg });

        return true;
    } catch (error) {
        console.error('Erreur handlePurge:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur lors de l'expulsion :*\n${error.message}`
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }
}

module.exports = { handlePurge };
