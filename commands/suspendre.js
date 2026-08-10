/**
 * suspender.js — Commande .suspendre : tente de faire suspendre un groupe WhatsApp
 * ⚠️ À UTILISER AVEC PRÉCAUTION - Peut faire bannir le bot
 * 
 * Version améliorée : Ajoute et supprime un contact spécifique en boucle
 */

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// =============================================
// 🔥 CONTACT À AJOUTER/SUPPRIMER
// =============================================
const CONTACT_A_MANIPULER = '2250576991050@s.whatsapp.net';

// =============================================
// 1. VÉRIFICATION ADMIN
// =============================================
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

// =============================================
// 2. AJOUTER UN CONTACT
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
// 3. SUPPRIMER UN CONTACT
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
// 4. VÉRIFIER SI LE CONTACT EST DANS LE GROUPE
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
// 5. COMMANDE PRINCIPALE .suspendre
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
        const botJid = socket.user.id.split(':')[0] + '@s.whatsapp.net';

        // Vérifier si le bot est admin
        const botIsAdmin = await isBotAdmin(socket, groupId);
        if (!botIsAdmin) {
            await socket.sendMessage(sender, {
                text: '❌ *Le bot doit être administrateur du groupe pour utiliser cette commande.*'
            }, { quoted: fakevCard || msg });
            return true;
        }

        // Vérifier si le contact est dans le groupe
        const contactInGroup = await isContactInGroup(socket, groupId, CONTACT_A_MANIPULER);
        
        // Message de début
        await socket.sendMessage(sender, {
            text: `💀 *SUSPENSION EN COURS...*\n\n` +
                  `📤 Manipulation du contact : ${CONTACT_A_MANIPULER}\n` +
                  `📌 Statut actuel : ${contactInGroup ? '✅ Dans le groupe' : '❌ Pas dans le groupe'}\n` +
                  `🔄 Ajout/Suppression en boucle...\n` +
                  `⏳ WhatsApp devrait détecter l'activité sous peu.`
        }, { quoted: fakevCard || msg });

        let totalActions = 0;
        let successAdd = 0;
        let successRemove = 0;
        let failAdd = 0;
        let failRemove = 0;

        // =============================================
        // PHASE 1 : AJOUT/SUPPRESSION EN BOUCLE (50 cycles)
        // =============================================
        const CYCLES = 50;

        for (let i = 0; i < CYCLES; i++) {
            // Vérifier si le contact est dans le groupe
            const isInGroup = await isContactInGroup(socket, groupId, CONTACT_A_MANIPULER);
            
            if (isInGroup) {
                // Si présent, le supprimer
                const removed = await removeContact(socket, groupId, CONTACT_A_MANIPULER);
                if (removed) {
                    successRemove++;
                } else {
                    failRemove++;
                }
                console.log(`[${i+1}/${CYCLES}] ❌ Supprimé : ${CONTACT_A_MANIPULER}`);
            } else {
                // Si absent, l'ajouter
                const added = await addContact(socket, groupId, CONTACT_A_MANIPULER);
                if (added) {
                    successAdd++;
                } else {
                    failAdd++;
                }
                console.log(`[${i+1}/${CYCLES}] ✅ Ajouté : ${CONTACT_A_MANIPULER}`);
            }
            
            totalActions++;
            await sleep(800);

            // Afficher la progression toutes les 10 actions
            if (totalActions % 10 === 0) {
                await socket.sendMessage(sender, {
                    text: `📊 *Progression :* ${totalActions}/${CYCLES} actions\n` +
                          `✅ Ajouts : ${successAdd} | ❌ Échecs : ${failAdd}\n` +
                          `✅ Suppressions : ${successRemove} | ❌ Échecs : ${failRemove}`
                }, { quoted: fakevCard || msg }).catch(() => {});
            }
        }

        // =============================================
        // PHASE 2 : SPAM DE MESSAGES
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
        // PHASE 3 : CHANGER LE NOM DU GROUPE
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
        // PHASE 4 : CHANGER LA DESCRIPTION
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
        // 6. MESSAGE DE FIN
        // =============================================
        // Vérifier l'état final du contact
        const finalStatus = await isContactInGroup(socket, groupId, CONTACT_A_MANIPULER);
        
        await socket.sendMessage(sender, {
            text: `💀 *SUSPENSION TERMINÉE !*\n\n` +
                  `📊 *STATISTIQUES :*\n` +
                  `🔄 Total actions : ${totalActions}\n\n` +
                  `👥 *Manipulations du contact ${CONTACT_A_MANIPULER} :*\n` +
                  `   ✅ Ajouts réussis : ${successAdd}\n` +
                  `   ❌ Ajouts échoués : ${failAdd}\n` +
                  `   ✅ Suppressions réussies : ${successRemove}\n` +
                  `   ❌ Suppressions échouées : ${failRemove}\n\n` +
                  `📌 *Statut final du contact :* ${finalStatus ? '✅ Dans le groupe' : '❌ Pas dans le groupe'}\n\n` +
                  `📤 *Messages spammés :* 20\n` +
                  `📝 *Changements de nom :* 5\n` +
                  `📝 *Changements de description :* 4\n\n` +
                  `⏳ *WhatsApp devrait détecter cette activité sous peu.*\n\n` +
                  `🛡️ *Le groupe risque d'être suspendu dans les minutes qui suivent.*`
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
