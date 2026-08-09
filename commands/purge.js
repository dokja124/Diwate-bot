/**
 * purge.js — .purge : expulse tous les membres du groupe.
 * pair.js : const { handlePurge } = require('./purge');
 *   case 'purge': { await handlePurge(socket, msg, sender, isGroup, args, fakevCard, isOwner); break; }
 */
const config = require('./config.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function isBotAdmin(socket, groupId) {
    try {
        const meta = await socket.groupMetadata(groupId);
        const botNum = socket.user.id.split('@')[0].split(':')[0];
        const p = meta.participants.find(p => p.id.split('@')[0].split(':')[0] === botNum);
        return p?.admin === 'admin' || p?.admin === 'superadmin';
    } catch (e) { return null; }
}

async function getParticipantsToKick(socket, groupId, ownerNumber) {
    const meta = await socket.groupMetadata(groupId);
    const botNum = socket.user.id.split('@')[0].split(':')[0];
    const ownerClean = ownerNumber.split('@')[0].replace(/[^0-9]/g, '');
    return meta.participants
        .filter(p => {
            const n = p.id.split('@')[0].split(':')[0];
            return n !== botNum && n !== ownerClean;
        })
        .map(p => p.id);
}

async function handlePurge(socket, msg, sender, isGroup, args, fakevCard, isOwner) {
    try {
        await socket.sendMessage(sender, { react: { text: '😈', key: msg.key } }).catch(() => {});

        if (!isGroup) {
            await socket.sendMessage(sender, { text: '❌ *Commande utilisable uniquement dans un groupe.*' }, { quoted: fakevCard || msg });
            return true;
        }
        if (!isOwner) {
            await socket.sendMessage(sender, { text: '❌ *Seul le propriétaire du bot peut utiliser cette commande.*' }, { quoted: fakevCard || msg });
            return true;
        }

        const groupId = msg.key.remoteJid;
        const botIsAdmin = await isBotAdmin(socket, groupId);
        if (botIsAdmin === false) {
            await socket.sendMessage(sender, { text: '❌ *Le bot doit être administrateur du groupe.*' }, { quoted: fakevCard || msg });
            return true;
        }

        const ownerNumber = config.OWNER_NUMBER + '@s.whatsapp.net';
        const participants = await getParticipantsToKick(socket, groupId, ownerNumber);
        if (participants.length === 0) {
            await socket.sendMessage(sender, { text: '✅ *Aucun membre à expulser.*\n(Le bot et le propriétaire sont protégés)' }, { quoted: fakevCard || msg });
            return true;
        }

        if (args[0]?.toLowerCase() !== 'confirm') {
            await socket.sendMessage(sender, {
                text: `⚠️ *CONFIRMATION REQUISE*\n\n${participants.length} membre(s) seront expulsés.\n✅ Tape : \`.purge confirm\``
            }, { quoted: fakevCard || msg });
            return true;
        }

        await socket.sendMessage(sender, { text: `🔄 *Début de la purge...*\nSuppression de ${participants.length} membre(s)...` }, { quoted: fakevCard || msg });

        let ok = 0, fail = 0;
        const total = participants.length;
        for (let i = 0; i < total; i++) {
            try {
                await socket.groupParticipantsUpdate(groupId, [participants[i]], 'remove');
                ok++;
            } catch (e) { fail++; }

            if ((i + 1) % 5 === 0 || i === total - 1) {
                await socket.sendMessage(sender, { text: `📊 *Progression :* ${i + 1}/${total}\n✅ Réussis : ${ok}\n❌ Échecs : ${fail}` }, { quoted: fakevCard || msg });
            }
            await sleep(800);
        }

        await socket.sendMessage(sender, {
            text: `✅ *Purge terminée !*\n\n👥 Expulsés : ${ok}\n❌ Échecs : ${fail}\n📊 Total : ${total}\n\n🛡️ *Le bot et le propriétaire ont été préservés.*`
        }, { quoted: fakevCard || msg });
        return true;
    } catch (error) {
        console.error('Erreur handlePurge:', error.message);
        await socket.sendMessage(sender, { text: `❌ *Erreur lors de la purge :*\n${error.message}` }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }
}

module.exports = { handlePurge };
                                                                                       
