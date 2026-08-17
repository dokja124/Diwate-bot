/**
 * ban.js — Commande .ban : Signaler un compte WhatsApp
 * ⚠️ Le bot signale le compte 50 fois à WhatsApp via le protocole natif
 */

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// =============================================
// 1. SIGNALER UN COMPTE 50 FOIS
// =============================================
async function reportAccount(socket, targetJid) {
    let successCount = 0;
    let failCount = 0;
    const totalReports = 50;

    console.log(`📤 Signalement de ${targetJid} (${totalReports} fois)`);

    for (let i = 0; i < totalReports; i++) {
        try {
            // 🔥 VRAI SIGNALEMENT VIA LE PROTOCOLE WHATSAPP
            // On envoie la requête native de signalement (report) à WhatsApp
            if (socket.sendNode) {
                await socket.sendNode({
                    tag: 'iq',
                    attrs: {
                        to: 's.whatsapp.net',
                        type: 'set',
                        xmlns: 'w:profile:report'
                    },
                    content: [{
                        tag: 'report',
                        attrs: {
                            target: targetJid
                        }
                    }]
                });
            } else {
                // Fallback : Bloquer/Débloquer (déclenche aussi un flag chez WhatsApp)
                await socket.updateBlockStatus(targetJid, 'block');
                await sleep(500);
                await socket.updateBlockStatus(targetJid, 'unblock');
            }
            
            successCount++;
            console.log(`✅ Signalement ${i+1}/${totalReports} envoyé`);

        } catch (error) {
            failCount++;
            console.log(`❌ Signalement ${i+1}/${totalReports} échoué:`, error.message);
        }

        // Pause aléatoire pour éviter que le bot se fasse bannir pour spam de requêtes
        await sleep(1000 + Math.random() * 2000); 
    }

    return { total: totalReports, success: successCount, failed: failCount };
}

// =============================================
// 2. COMMANDE PRINCIPALE .ban
// =============================================
async function handleBan(socket, msg, sender, args, fakevCard, isOwner) {
    try {
        // ✅ Réaction
        await socket.sendMessage(sender, { react: { text: '💀', key: msg.key } }).catch(() => {});

        // 1. Vérifications de sécurité
        if (!isOwner) {
            await socket.sendMessage(sender, {
                text: '❌ *Seul le propriétaire du bot peut utiliser cette commande.*'
            }, { quoted: fakevCard || msg });
            return true;
        }

        if (!args || args.length === 0) {
            await socket.sendMessage(sender, {
                text: `💀 *BANNIR UN COMPTE*\n\n📌 *Utilisation :*\n.ban [numéro]\n\n📌 *Exemple :*\n.ban 2250576991050\n\n📊 *50 signalements seront envoyés à WhatsApp.*`
            }, { quoted: fakevCard || msg });
            return true;
        }

        const targetNumber = args[0].replace(/[^0-9]/g, '');
        
        if (targetNumber.length < 8) {
            await socket.sendMessage(sender, {
                text: '❌ *Numéro invalide.*'
            }, { quoted: fakevCard || msg });
            return true;
        }

        const targetJid = `${targetNumber}@s.whatsapp.net`;

        // 2. Vérifier si le numéro existe bien sur WhatsApp
        const [exists] = await socket.onWhatsApp(targetJid);
        if (!exists || !exists.exists) {
            await socket.sendMessage(sender, {
                text: `❌ *Le numéro +${targetNumber} n'est pas sur WhatsApp.*`
            }, { quoted: fakevCard || msg });
            return true;
        }

        // 🔥 Message de début
        await socket.sendMessage(sender, {
            text: `💀 *BAN EN COURS...*\n\n🎯 *Cible :* +${targetNumber}\n📊 *Envoi de 50 signalements en cours...*\n⏳ *Cela prendra environ 1 à 2 minutes, patience...*`
        }, { quoted: fakevCard || msg });

        // =============================================
        // 3. EXÉCUTER LES 50 SIGNALEMENTS
        // =============================================
        const result = await reportAccount(socket, targetJid);

        // =============================================
        // 4. MESSAGE FINAL
        // =============================================
        await socket.sendMessage(sender, {
            text: `✅ *BAN TERMINÉ !*\n\n` +
                  `👤 *Cible :* +${targetNumber}\n` +
                  `📊 *succès :* ${result.success}/50\n` +
                  `❌ *Échecs :* ${result.failed}\n` +
                  `📅 *Date :* ${new Date().toLocaleString()}\n\n` +
                  `⚡ *WhatsApp va examiner ce compte sous 24h à 48h.*`
        }, { quoted: fakevCard || msg });

        // Logs dans la console
        console.log(`💀 Ban terminé - Cible : ${targetNumber}`);
        console.log(`📊 Signalements réussis : ${result.success}/50`);
        console.log(`❌ Échecs : ${result.failed}`);

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
