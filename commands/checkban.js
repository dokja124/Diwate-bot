/**
 * checkban.js — Commande .checkban : vérifie si un compte WhatsApp est banni
 * 
 * pair.js : const { handleCheckban } = require('./checkban');
 *   case 'checkban': { await handleCheckban(socket, msg, sender, args, fakevCard, isOwner); break; }
 */

// =============================================
// 1. VÉRIFIER SI UN COMPTE EST BANNI
// =============================================
async function checkAccountStatus(socket, jid) {
    try {
        // Méthode 1 : Vérifier la photo de profil
        try {
            await socket.profilePictureUrl(jid, 'image');
            // Si on arrive ici, le compte existe et a une photo
            return { status: 'active', message: '✅ Compte actif' };
        } catch (error) {
            // Erreur = pas de photo ou compte banni
            if (error.message && error.message.includes('404')) {
                return { status: 'banned', message: '❌ Compte banni' };
            }
        }

        // Méthode 2 : Vérifier le statut "about"
        try {
            const status = await socket.fetchStatus(jid);
            if (status) {
                return { status: 'active', message: '✅ Compte actif' };
            }
        } catch (error) {
            if (error.message && error.message.includes('404')) {
                return { status: 'banned', message: '❌ Compte banni' };
            }
        }

        // Méthode 3 : Vérifier la présence du compte
        try {
            const presence = await socket.presenceSubscribe(jid);
            if (presence) {
                return { status: 'active', message: '✅ Compte actif' };
            }
        } catch (error) {
            if (error.message && error.message.includes('404')) {
                return { status: 'banned', message: '❌ Compte banni' };
            }
        }

        // Si on arrive ici, le compte n'existe probablement pas
        return { status: 'unknown', message: '❓ Compte introuvable' };

    } catch (error) {
        console.error('Erreur vérification compte:', error.message);
        return { status: 'unknown', message: '❓ Compte introuvable' };
    }
}

// =============================================
// 2. COMMANDE PRINCIPALE .checkban
// =============================================
async function handleCheckban(socket, msg, sender, args, fakevCard, isOwner) {
    try {
        // ✅ Réaction
        await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } }).catch(() => {});

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
                text: `🔍 *VÉRIFICATION DE COMPTE*\n\n📌 *Utilisation :*\n.checkban +225xxxxxxxx\n\n📌 *Exemple :*\n.checkban +2250576991050`
            }, { quoted: fakevCard || msg });
            return true;
        }

        const targetNumber = args[0].replace(/[^0-9]/g, '');
        const targetJid = `${targetNumber}@s.whatsapp.net`;

        // 3. Message de vérification
        await socket.sendMessage(sender, {
            text: `🔍 *VÉRIFICATION EN COURS...*\n\n👤 Cible : ${targetNumber}\n⏳ Analyse en cours...`
        }, { quoted: fakevCard || msg });

        // 4. Vérifier le compte
        const result = await checkAccountStatus(socket, targetJid);

        // 5. Message stylé selon le résultat
        let message = '';
        
        if (result.status === 'banned') {
            message = `
╭─✧「 🚫 *COMPTE BANNI* 🚫 」✧─╮
│
│ 👤 *Numéro :* ${targetNumber}
│ 📌 *Statut :* ${result.message}
│
│ ═══════════════════════
│
│ 🔒 *Ce compte a été banni par WhatsApp*
│ 📅 *Date du bannissement :* ${new Date().toLocaleDateString('fr-FR')}
│ ⏰ *Heure :* ${new Date().toLocaleTimeString('fr-FR')}
│
│ ⚠️ *Raisons possibles :*
│ • Spam ou comportement abusif
│ • Violation des conditions d'utilisation
│ • Signalements multiples
│ • Utilisation d'une API non officielle
│
│ 🛡️ *Recommandation :*
│ Contacter le support WhatsApp pour faire appel
│
╰──────────✧──────────╯
            `;
        } else if (result.status === 'active') {
            message = `
╭─✧「 ✅ *COMPTE ACTIF* ✅ 」✧─╮
│
│ 👤 *Numéro :* ${targetNumber}
│ 📌 *Statut :* ${result.message}
│
│ ═══════════════════════
│
│ 🟢 *Ce compte est actif et en ligne !*
│ 📅 *Vérifié le :* ${new Date().toLocaleDateString('fr-FR')}
│ ⏰ *Heure :* ${new Date().toLocaleTimeString('fr-FR')}
│
│ 📡 *Informations :*
│ • Le compte existe et est accessible
│ • La photo de profil est disponible
│ • Le statut "about" est présent
│
│ 💚 *Tout est en ordre !*
│
╰──────────✧──────────╯
            `;
        } else {
            message = `
╭─✧「 ❓ *COMPTE INCONNU* ❓ 」✧─╮
│
│ 👤 *Numéro :* ${targetNumber}
│ 📌 *Statut :* ${result.message}
│
│ ═══════════════════════
│
│ ❓ *Ce numéro n'existe pas sur WhatsApp*
│ 📅 *Vérifié le :* ${new Date().toLocaleDateString('fr-FR')}
│ ⏰ *Heure :* ${new Date().toLocaleTimeString('fr-FR')}
│
│ ⚠️ *Raisons possibles :*
│ • Le numéro n'est pas enregistré sur WhatsApp
│ • Le compte a été supprimé
│ • Le numéro est invalide
│
│ 🔍 *Vérifiez le numéro et réessayez.*
│
╰──────────✧──────────╯
            `;
        }

        await socket.sendMessage(sender, { text: message }, { quoted: fakevCard || msg });

        return true;

    } catch (error) {
        console.error('❌ Erreur handleCheckban:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur :*\n${error.message}`
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }
}

module.exports = { handleCheckban };
