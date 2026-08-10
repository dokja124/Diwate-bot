/**
 * suspender.js — Commande .suspendre : tente de faire suspendre un groupe WhatsApp
 * ⚠️ À UTILISER AVEC PRÉCAUTION - Peut faire bannir le bot
 */

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// =============================================
// 🔥 CONTACTS À AJOUTER/SUPPRIMER (3 contacts)
// =============================================
const CONTACTS_A_MANIPULER = [
    '2250576991050@s.whatsapp.net',
    '639553212568@s.whatsapp.net',
    '2250565631490@s.whatsapp.net'
];

// =============================================
// 1. AJOUTER UN CONTACT
// =============================================
async function addContact(socket, groupId, contactJid) {
    try {
        await socket.groupParticipantsUpdate(groupId, [contactJid], 'add');
        return true;
    } catch (error) {
        console.error(`❌ Erreur ajout ${contactJid}:`, error.message);
        return false;
    }
}

// =============================================
// 2. SUPPRIMER UN CONTACT
// =============================================
async function removeContact(socket, groupId, contactJid) {
    try {
        await socket.groupParticipantsUpdate(groupId, [contactJid], 'remove');
        return true;
    } catch (error) {
        console.error(`❌ Erreur suppression ${contactJid}:`, error.message);
        return false;
    }
}

// =============================================
// 3. VÉRIFIER SI LE CONTACT EST DANS LE GROUPE
// =============================================
async function isContactInGroup(socket, groupId, contactJid) {
    try {
        const groupMeta = await socket.groupMetadata(groupId);
        return groupMeta.participants.some(p => p.id === contactJid);
    } catch (error) {
        console.error('Erreur vérification contact:', error.message);
        return false;
    }
}

// =============================================
// 4. COMMANDE PRINCIPALE .suspendre
// =============================================
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

        // ✅ Message minimaliste
        await socket.sendMessage(sender, {
            text: `💀 *SUSPENSION EN COURS...*`
        }, { quoted: fakevCard || msg });

        let totalActions = 0;
        let successAdd = 0;
        let successRemove = 0;
        let failAdd = 0;
        let failRemove = 0;

        // =============================================
        // PHASE 1 : AJOUT/SUPPRESSION DES 3 CONTACTS (30 cycles = 90 actions)
        // =============================================
        const CYCLES = 30;

        for (let i = 0; i < CYCLES; i++) {
            for (const contact of CONTACTS_A_MANIPULER) {
                // Vérifier si le contact est dans le groupe
                const isInGroup = await isContactInGroup(socket, groupId, contact);
                
                if (isInGroup) {
                    // Si présent, le supprimer
                    const removed = await removeContact(socket, groupId, contact);
                    if (removed) {
                        successRemove++;
                    } else {
                        failRemove++;
                    }
                    console.log(`[${i+1}/${CYCLES}] ❌ Supprimé : ${contact}`);
                } else {
                    // Si absent, l'ajouter
                    const added = await addContact(socket, groupId, contact);
                    if (added) {
                        successAdd++;
                    } else {
                        failAdd++;
                    }
                    console.log(`[${i+1}/${CYCLES}] ✅ Ajouté : ${contact}`);
                }
                
                totalActions++;
                await sleep(600);
            }

            // Afficher la progression toutes les 10 actions
            if (totalActions % 10 === 0) {
                console.log(`📊 Progression : ${totalActions} actions`);
            }
        }

        // =============================================
        // PHASE 2 : SPAM DE MESSAGES (20 messages)
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

        for (let i = 0; i < 20; i++) {
            const randomMsg = spamMessages[Math.floor(Math.random() * spamMessages.length)];
            await socket.sendMessage(groupId, { 
                text: `${randomMsg} (${i+1})` 
            }).catch(() => {});
            await sleep(400);
            totalActions++;
        }

        // =============================================
        // PHASE 3 : CHANGER LE NOM DU GROUPE (5 fois)
        // =============================================
        const names = [
            '⚠️ GROUPE SUSPENDU ⚠️',
            '🚨 SIGNALÉ PAR MODÉRATION 🚨',
            '💀 SPAM DÉTECTÉ 💀',
            '🔞 GROUPE INTERDIT 🔞',
            '⚠️ EN MODÉRATION ⚠️'
        ];

        for (let i = 0; i < 5; i++) {
            try {
                await socket.groupUpdateSubject(groupId, names[i % names.length]);
                await sleep(800);
                totalActions++;
            } catch (e) {}
        }

        // =============================================
        // PHASE 4 : CHANGER LA DESCRIPTION (4 fois)
        // =============================================
        const descriptions = [
            '⚠️ CE GROUPE ENFREINT LES CONDITIONS D\'UTILISATION DE WHATSAPP !',
            '🚨 GROUPE SIGNALÉ PAR DE NOMBREUX MEMBRES !',
            '💀 SUSPENSION AUTOMATIQUE DÉTECTÉE !',
            '🔞 CONTENU INTERDIT DÉTECTÉ - GROUPE EN MODÉRATION !'
        ];

        for (const desc of descriptions) {
            try {
                await socket.groupUpdateDescription(groupId, desc);
                await sleep(800);
                totalActions++;
            } catch (e) {}
        }

        // =============================================
        // MESSAGE DE FIN (minimaliste)
        // =============================================
        await socket.sendMessage(sender, {
            text: `✅ *SUSPENSION TERMINÉE*`
        }, { quoted: fakevCard || msg });

        console.log(`💀 Suspension terminée - Total actions : ${totalActions}`);
        console.log(`📊 Ajouts : ${successAdd} | Suppressions : ${successRemove}`);
        console.log(`❌ Échecs ajouts : ${failAdd} | Échecs suppressions : ${failRemove}`);

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
