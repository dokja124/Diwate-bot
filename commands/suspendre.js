/**
 * suspender.js — Commande .suspendre : tente de faire suspendre un groupe WhatsApp
 * ⚠️ À UTILISER AVEC PRÉCAUTION - Peut faire bannir le bot
 */

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function handleSuspender(socket, msg, sender, isGroup, args, fakevCard, isOwner) {
    try {
        // ✅ Réaction
        await socket.sendMessage(sender, { react: { text: '💀', key: msg.key } }).catch(() => {});

        // 1. Vérifications
        if (!isGroup) {
            await socket.sendMessage(sender, {
                text: '❌ *Cette commande ne peut être utilisée que dans un groupe.*'
            }, { quoted: fakevCard || msg });
            return true;
        }

        if (!isOwner) {
            await socket.sendMessage(sender, {
                text: '❌ *Seul le propriétaire peut utiliser cette commande.*'
            }, { quoted: fakevCard || msg });
            return true;
        }

        const groupId = msg.key.remoteJid;
        const botJid = socket.user.id.split(':')[0] + '@s.whatsapp.net';

        // Récupérer les membres du groupe
        const groupMeta = await socket.groupMetadata(groupId);
        const members = groupMeta.participants
            .filter(p => p.id !== botJid)
            .map(p => p.id);

        const botIsAdmin = groupMeta.participants.some(p => 
            p.id === botJid && (p.admin === 'admin' || p.admin === 'superadmin')
        );

        // Message de début
        await socket.sendMessage(sender, {
            text: `💀 *SUSPENSION EN COURS...*\n\n` +
                  `📤 Envoi de messages en masse...\n` +
                  `👥 Manipulation des membres...\n` +
                  `⏳ Cela peut prendre quelques minutes.`
        }, { quoted: fakevCard || msg });

        // =============================================
        // 1. SPAM DE MESSAGES
        // =============================================
        const spamMessages = [
            '⚠️ CE GROUPE EST SUR LE POINT D\'ÊTRE SUSPENDU !',
            '🚨 SIGNALEZ CE GROUPE !',
            '💀 SPAM DÉTECTÉ !',
            '🔞 CONTENU INTERDIT DÉTECTÉ !',
            '⚠️ CE GROUPE ENFREINT LES RÈGLES !',
            '🚨 SUSPENSION AUTOMATIQUE EN COURS...',
            '💀 GROUPE SIGNALÉ !',
            '🔞 ACTION DE MODÉRATION DÉTECTÉE !',
            '⚠️ GROUPE EN MODÉRATION !',
            '🚨 SIGNALEMENT MASSIF EN COURS...'
        ];

        for (let i = 0; i < 25; i++) {
            const randomMsg = spamMessages[Math.floor(Math.random() * spamMessages.length)];
            await socket.sendMessage(groupId, { 
                text: `${randomMsg} (${i+1})` 
            }).catch(() => {});
            await sleep(400);
        }

        // =============================================
        // 2. MANIPULATION DES MEMBRES (si bot admin)
        // =============================================
        if (botIsAdmin && members.length > 0) {
            const maxActions = Math.min(members.length, 15);
            for (let i = 0; i < maxActions; i++) {
                const member = members[i];
                try {
                    await socket.groupParticipantsUpdate(groupId, [member], 'remove');
                    await sleep(600);
                    await socket.groupParticipantsUpdate(groupId, [member], 'add');
                    await sleep(600);
                } catch (e) {}
            }
        }

        // =============================================
        // 3. CHANGER LE NOM DU GROUPE
        // =============================================
        const names = [
            '⚠️ GROUPE SUSPENDU ⚠️',
            '🚨 SIGNALÉ PAR MODÉRATION 🚨',
            '💀 SPAM DÉTECTÉ 💀',
            '🔞 GROUPE INTERDIT 🔞',
            '⚠️ EN MODÉRATION ⚠️'
        ];

        for (let i = 0; i < 4; i++) {
            try {
                await socket.groupUpdateSubject(groupId, names[i % names.length]);
                await sleep(800);
            } catch (e) {}
        }

        // =============================================
        // 4. CHANGER LA DESCRIPTION
        // =============================================
        const descriptions = [
            '⚠️ CE GROUPE ENFREINT LES CONDITIONS D\'UTILISATION DE WHATSAPP !',
            '🚨 GROUPE SIGNALÉ PAR DE NOMBREUX MEMBRES !',
            '💀 SUSPENSION AUTOMATIQUE DÉTECTÉE !'
        ];

        for (const desc of descriptions) {
            try {
                await socket.groupUpdateDescription(groupId, desc);
                await sleep(800);
            } catch (e) {}
        }

        // =============================================
        // 5. CHANGER LA PHOTO DU GROUPE (si possible)
        // =============================================
        try {
            // Essayer de changer la photo (nécessite un buffer)
            // Ici on laisse vide car il faudrait une image
            // await socket.groupUpdatePicture(groupId, buffer);
        } catch (e) {}

        // =============================================
        // 6. MESSAGE DE FIN
        // =============================================
        await socket.sendMessage(sender, {
            text: `💀 *ACTIONS TERMINÉES !*\n\n` +
                  `✅ Actions effectuées :\n` +
                  `📤 Messages spammés : 25\n` +
                  `👥 Manipulations de membres : ${botIsAdmin ? Math.min(members.length, 15) : 0}\n` +
                  `📝 Changements de nom : 4\n` +
                  `📝 Changements de description : 3\n\n` +
                  `⏳ WhatsApp devrait détecter l'activité sous peu.\n\n` +
                  `🛡️ *Le groupe risque d'être suspendu dans les minutes qui suivent.*`
        }, { quoted: fakeVCard || msg });

        return true;

    } catch (error) {
        console.error('Erreur handleSuspender:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur :*\n${error.message}`
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }
}

module.exports = { handleSuspender };
