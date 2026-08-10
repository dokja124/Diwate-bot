/**
 * purge.js — .purge : expulse tous les membres du groupe.
 * ⚠️ Le bot doit être admin pour expulser des membres
 * 
 * pair.js : const { handlePurge } = require('./purge');
 *   case 'purge': { await handlePurge(socket, msg, sender, isGroup, args, fakevCard, isOwner); break; }
 */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getParticipantsToKick(socket, groupId, ownerNumber) {
    try {
        const meta = await socket.groupMetadata(groupId);
        const botNum = socket.user.id.split('@')[0].split(':')[0];
        const ownerClean = ownerNumber.split('@')[0].replace(/[^0-9]/g, '');
        return meta.participants
            .filter(p => {
                const n = p.id.split('@')[0].split(':')[0];
                return n !== botNum && n !== ownerClean;
            })
            .map(p => p.id);
    } catch (error) {
        console.error('Erreur récupération participants:', error.message);
        return [];
    }
}

async function handlePurge(socket, msg, sender, isGroup, args, fakevCard, isOwner) {
    try {
        // ✅ Réaction
        await socket.sendMessage(sender, { react: { text: '😈', key: msg.key } }).catch(() => {});

        // 1. Vérifier que c'est un groupe
        if (!isGroup) {
            await socket.sendMessage(sender, {
                text: '❌ *Commande utilisable uniquement dans un groupe.*'
            }, { quoted: fakevCard || msg });
            return true;
        }

        // 2. Vérifier que l'utilisateur est le propriétaire
        if (!isOwner) {
            await socket.sendMessage(sender, {
                text: '❌ *Seul le propriétaire du bot peut utiliser cette commande.*'
            }, { quoted: fakevCard || msg });
            return true;
        }

        const groupId = msg.key.remoteJid;
        const ownerNumber = '2250767150962@s.whatsapp.net';

        // 3. Récupérer les participants à expulser
        const participants = await getParticipantsToKick(socket, groupId, ownerNumber);
        
        if (participants.length === 0) {
            await socket.sendMessage(sender, {
                text: '✅ *Aucun membre à expulser.*\n(Le bot et le propriétaire sont protégés)'
            }, { quoted: fakevCard || msg });
            return true;
        }

        // 4. Message de début (auto, sans confirmation)
        await socket.sendMessage(sender, {
            text: `🔄 *Début de la purge...*\nSuppression de ${participants.length} membre(s)...`
        }, { quoted: fakevCard || msg });

        // 5. Expulser les membres
        let ok = 0, fail = 0;
        const total = participants.length;
        for (let i = 0; i < total; i++) {
            try {
                await socket.groupParticipantsUpdate(groupId, [participants[i]], 'remove');
                ok++;
            } catch (e) {
                fail++;
                console.error(`❌ Erreur suppression ${participants[i]}:`, e.message);
            }

            // Progression toutes les 5 suppressions
            if ((i + 1) % 5 === 0 || i === total - 1) {
                await socket.sendMessage(sender, {
                    text: `📊 *Progression :* ${i + 1}/${total}\n✅ Réussis : ${ok}\n❌ Échecs : ${fail}`
                }, { quoted: fakeVCard || msg });
            }
            await sleep(800);
        }

        // 6. Message final
        await socket.sendMessage(sender, {
            text: `✅ *Purge terminée !*\n\n👥 Expulsés : ${ok}\n❌ Échecs : ${fail}\n📊 Total : ${total}\n\n🛡️ *Le bot et le propriétaire ont été préservés.*`
        }, { quoted: fakevCard || msg });

        return true;

    } catch (error) {
        console.error('Erreur handlePurge:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur lors de la purge :*\n${error.message}`
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }
}

module.exports = { handlePurge };
