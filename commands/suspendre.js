/**
 * suspender.js — Provoque la suspension d'un groupe WhatsApp
 * ⚠️ À UTILISER AVEC PRÉCAUTION
 */

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function handleSuspender(socket, msg, sender, isGroup, args, fakevCard, isOwner) {
    try {
        // ✅ Réaction
        await socket.sendMessage(sender, { react: { text: '💀', key: msg.key } }).catch(() => {});

        // 1. Vérifications de sécurité
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

        // 2. Confirmation
        await socket.sendMessage(sender, {
            text: `💀 *SUSPENSION DU GROUPE*\n\n` +
                  `⚠️ Cette action va envoyer un grand nombre de messages et d'actions pour faire suspendre le groupe par WhatsApp.\n\n` +
                  `✅ Pour confirmer, tape :\n\`${args[0] || '.'}suspender confirm\``
        }, { quoted: fakevCard || msg });

        const confirmArg = args[1]?.toLowerCase();
        if (confirmArg !== 'confirm') {
            return true;
        }

        // 3. Message de début
        await socket.sendMessage(sender, {
            text: `💀 *DÉBUT DE LA SUSPENSION...*\n\n` +
                  `📤 Envoi de messages en masse...\n` +
                  `👥 Ajout/suppression de membres...\n` +
                  `⏳ Cela peut prendre quelques minutes.`
        }, { quoted: fakevCard || msg });

        // =============================================
        // 4. ACTIONS POUR PROVOQUER LA SUSPENSION
        // =============================================

        const botJid = socket.user.id.split(':')[0] + '@s.whatsapp.net';
        
        // Récupérer les membres
        const groupMeta = await socket.groupMetadata(groupId);
        const members = groupMeta.participants
            .filter(p => p.id !== botJid)
            .map(p => p.id);

        // 🔥 ACTION 1 : Spam de messages
        const spamMessages = [
            '⚠️ CE GROUPE EST SUR LE POINT D\'ÊTRE SUSPENDU !',
            '🚨 SIGNALEZ CE GROUPE !',
            '💀 SPAM DÉTECTÉ !',
            '🔞 CONTENU INTERDIT DÉTECTÉ !',
            '⚠️ CE GROUPE ENFREINT LES RÈGLES !',
            '🚨 SUSPENSION AUTOMATIQUE EN COURS...',
            '💀 GROUPE SIGNALÉ !',
            '🔞 ACTION DE MODÉRATION DÉTECTÉE !'
        ];

        // Envoyer des messages en boucle
        for (let i = 0; i < 30; i++) {
            const randomMsg = spamMessages[Math.floor(Math.random() * spamMessages.length)];
            await socket.sendMessage(groupId, { 
                text: `${randomMsg} (${i+1})` 
            }).catch(() => {});
            await sleep(500); // Pause pour éviter le rate limit
        }

        // 🔥 ACTION 2 : Ajouter/retirer des membres (si le bot est admin)
        const botIsAdmin = groupMeta.participants.some(p => 
            p.id === botJid && (p.admin === 'admin' || p.admin === 'superadmin')
        );

        if (botIsAdmin && members.length > 0) {
            for (let i = 0; i < Math.min(members.length, 20); i++) {
                const member = members[i];
                try {
                    // Retirer le membre
                    await socket.groupParticipantsUpdate(groupId, [member], 'remove');
                    await sleep(800);
                    // Le réajouter immédiatement
                    await socket.groupParticipantsUpdate(groupId, [member], 'add');
                    await sleep(800);
                } catch (e) {}
            }
        }

        // 🔥 ACTION 3 : Changer le nom du groupe en boucle
        const names = [
            '⚠️ GROUPE SUSPENDU ⚠️',
            '🚨 SIGNALÉ 🚨',
            '💀 SPAM 💀',
            '🔞 INTERDIT 🔞',
            '⚠️ EN MODÉRATION ⚠️'
        ];

        for (let i = 0; i < 5; i++) {
            try {
                await socket.groupUpdateSubject(groupId, names[i % names.length]);
                await sleep(1000);
            } catch (e) {}
        }

        // 🔥 ACTION 4 : Changer la description
        const descriptions = [
            '⚠️ CE GROUPE ENFREINT LES CONDITIONS D\'UTILISATION DE WHATSAPP !',
            '🚨 GROUPE SIGNALÉ PAR DE NOMBREUX MEMBRES !',
            '💀 SUSPENSION AUTOMATIQUE DÉTECTÉE !'
        ];

        for (const desc of descriptions) {
            try {
                await socket.groupUpdateDescription(groupId, desc);
                await sleep(1000);
            } catch (e) {}
        }

        // 5. Message de fin
        await socket.sendMessage(sender, {
            text: `💀 *SUSPENSION EN COURS...*\n\n` +
                  `✅ Actions envoyées :\n` +
                  `📤 Messages spammés : 30\n` +
                  `👥 Manipulations de membres : 20\n` +
                  `📝 Modifications de groupe : 10\n\n` +
                  `⏳ WhatsApp devrait détecter l'activité suspecte sous peu.\n\n` +
                  `🛡️ *Le groupe devrait être suspendu dans les minutes qui suivent.*`
        }, { quoted: fakevCard || msg });

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
