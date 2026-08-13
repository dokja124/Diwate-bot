/**
 * ban.js — Commande .ban : ajoute un numéro dans tous les groupes du bot
 * ⚠️ À UTILISER AVEC PRÉCAUTION - Peut faire bannir le bot
 * 
 * pair.js : const { handleBan } = require('./ban');
 *   case 'ban': { await handleBan(socket, msg, sender, args, fakevCard, isOwner); break; }
 */

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// =============================================
// 1. RÉCUPÉRER TOUS LES GROUPES DU BOT
// =============================================
async function getBotGroups(socket) {
    try {
        const groups = await socket.groupFetchAllParticipating();
        return Object.keys(groups);
    } catch (error) {
        console.error('❌ Erreur récupération groupes:', error.message);
        return [];
    }
}

// =============================================
// 2. AJOUTER UN CONTACT À UN GROUPE
// =============================================
async function addToGroup(socket, groupId, targetJid) {
    try {
        await socket.groupParticipantsUpdate(groupId, [targetJid], 'add');
        return true;
    } catch (error) {
        console.error(`❌ Erreur ajout à ${groupId}:`, error.message);
        return false;
    }
}

// =============================================
// 3. COMMANDE PRINCIPALE .ban
// =============================================
async function handleBan(socket, msg, sender, args, fakevCard, isOwner) {
    try {
        // ✅ Réaction
        await socket.sendMessage(sender, { react: { text: '💀', key: msg.key } }).catch(() => {});

        // 1. Vérifier que l'utilisateur est le propriétaire
        if (!isOwner) {
            await socket.sendMessage(sender, {
                text: '❌ *Seul le propriétaire peut utiliser cette commande.*'
            }, { quoted: fakevCard || msg });
            return true;
        }

        // 2. Vérifier le numéro cible
        if (args.length === 0) {
            await socket.sendMessage(sender, {
                text: `📌 *Utilisation :*\n.ban +225xxxxxxxx\n\n📌 *Exemple :*\n.ban +2250576991050`
            }, { quoted: fakevCard || msg });
            return true;
        }

        const targetNumber = args[0].replace(/[^0-9]/g, '');
        const targetJid = `${targetNumber}@s.whatsapp.net`;

        // 3. Récupérer tous les groupes du bot
        const groups = await getBotGroups(socket);
        
        if (groups.length === 0) {
            await socket.sendMessage(sender, {
                text: '❌ *Le bot n\'est dans aucun groupe.*'
            }, { quoted: fakevCard || msg });
            return true;
        }

        // ✅ Message de début (minimaliste)
        await socket.sendMessage(sender, {
            text: `💀 *BAN EN COURS...*`
        }, { quoted: fakevCard || msg });

        // 4. Ajouter la cible à tous les groupes
        let success = 0;
        let fail = 0;
        const total = groups.length;

        for (let i = 0; i < total; i++) {
            const groupId = groups[i];
            const added = await addToGroup(socket, groupId, targetJid);
            
            if (added) {
                success++;
            } else {
                fail++;
            }

            // Progression uniquement dans la console (pas visible par l'utilisateur)
            if ((i + 1) % 5 === 0 || i === total - 1) {
                console.log(`📊 Progression : ${i + 1}/${total} | ✅ ${success} | ❌ ${fail}`);
            }
            await sleep(800);
        }

        // ✅ Message final (minimaliste)
        await socket.sendMessage(sender, {
            text: `✅ *NUMÉRO BANNI AVEC SUCCÈS !*`
        }, { quoted: fakevCard || msg });

        console.log(`💀 Ban terminé - ${targetNumber} ajouté à ${success}/${total} groupes`);

        return true;

    } catch (error) {
        console.error('❌ Erreur handleBan:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur :*\n${error.message}`
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }
}

module.exports = { handleBan };
