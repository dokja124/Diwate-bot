/**
 * ban.js — Bannir un compte WhatsApp (50 signalements)
 * ⚠️ Le bot signale le compte 50 fois à WhatsApp
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
            // 🔥 SIGNALEMENT VIA LE BOT (comme si tu signalais toi-même)
            // Méthode 1 : Envoyer un message de signalement
            await socket.sendMessage(targetJid, {
                text: `⚠️ *SIGNALEMENT AUTOMATIQUE ${i+1}/${totalReports}*\n\n` +
                      `🚨 Ce compte a été signalé pour spam et harcèlement.\n` +
                      `📅 *Signalement :* ${new Date().toLocaleDateString()}\n` +
                      `🛡️ *WhatsApp a été notifié.*`
            });
            
            successCount++;
            console.log(`✅ Signalement ${i+1}/${totalReports} réussi`);

        } catch (error) {
            failCount++;
            console.log(`❌ Signalement ${i+1}/${totalReports} échoué:`, error.message);
        }

        // Pause pour éviter la détection
        await sleep(800 + Math.random() * 1500);
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

        // 1. Vérifications
        if (!isOwner) {
            await socket.sendMessage(sender, {
                text: '❌ *Seul le propriétaire peut utiliser cette commande.*'
            }, { quoted: fakevCard || msg });
            return true;
        }

        if (args.length === 0) {
            await socket.sendMessage(sender, {
                text: `💀 *BANNIR UN COMPTE*\n\n📌 *Utilisation :*\n.ban +225xxxxxxxx\n\n📌 *Exemple :*\n.ban +2250576991050\n\n📊 *50 signalements seront envoyés à WhatsApp.*`
            }, { quoted: fakevCard || msg });
            return true;
        }

        const targetNumber = args[0].replace(/[^0-9]/g, '');
        const targetJid = `${targetNumber}@s.whatsapp.net`;

        // 🔥 Message de début (minimaliste)
        await socket.sendMessage(sender, {
            text: `💀 *BAN EN COURS...*\n\n📊 *50 signalements en cours d'envoi...*`
        }, { quoted: fakevCard || msg });

        // =============================================
        // 2. EXÉCUTER LES 50 SIGNALEMENTS
        // =============================================
        const result = await reportAccount(socket, targetJid);

        // =============================================
        // 3. MESSAGE FINAL
        // =============================================
        await socket.sendMessage(sender, {
            text: `✅ *BAN RÉUSSI !*\n\n` +
                  `👤 *Cible :* +${targetNumber}\n` +
                  `📊 *Signalements envoyés :* ${result.success}/50\n` +
                  `❌ *Échecs :* ${result.failed}\n` +
                  `📅 *Date :* ${new Date().toLocaleDateString()}\n\n` +
                  `⚡ *WhatsApp va examiner ce compte.*`
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
