/**
 * checkban.js — Vérification de compte WhatsApp (multi-méthodes)
 */

const axios = require('axios');

// =============================================
// 1. VÉRIFICATION VIA L'API (Méthode principale)
// =============================================
async function checkBanAPI(numero) {
    try {
        // Nettoyer le numéro (garder uniquement les chiffres)
        const cleanNumber = numero.replace(/[^0-9]/g, '');
        
        // Essayer différents formats
        const formats = [
            cleanNumber,                          // 2250576991050
            `+${cleanNumber}`,                    // +2250576991050
            `${cleanNumber.substring(0, 3)} ${cleanNumber.substring(3)}`, // 225 0576991050
        ];

        for (const format of formats) {
            try {
                const url = `https://banchek-by-awais.kesug.com/bancheck.php?numero=${encodeURIComponent(format)}`;
                console.log(`🔍 Test avec format: ${format}`);
                
                const response = await axios.get(url, {
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'application/json'
                    }
                });

                console.log(`📊 Réponse brute:`, JSON.stringify(response.data, null, 2));

                // ✅ Vérifier si la réponse indique un compte valide
                const data = response.data;

                // Cas 1: Réponse avec "banned": false → compte actif
                if (data && data.banned === false) {
                    return { 
                        status: 'active', 
                        data: data,
                        message: data.message || 'Compte actif'
                    };
                }

                // Cas 2: Réponse avec "banned": true → compte banni
                if (data && data.banned === true) {
                    return { 
                        status: 'banned', 
                        data: data,
                        message: data.reason || data.message || 'Compte banni'
                    };
                }

                // Cas 3: Réponse avec error: false → compte actif
                if (data && data.error === false) {
                    return { 
                        status: 'active', 
                        data: data,
                        message: data.message || 'Compte actif'
                    };
                }

                // Cas 4: Vérifier le message
                const msg = data?.message?.toLowerCase() || '';
                if (msg.includes('not banned') || msg.includes('not ban')) {
                    return { status: 'active', data: data, message: data.message };
                }
                if (msg.includes('banned')) {
                    return { status: 'banned', data: data, message: data.message };
                }

            } catch (error) {
                console.log(`❌ Erreur avec format ${format}:`, error.message);
                continue;
            }
        }

        return { status: 'unknown', message: 'Impossible de vérifier ce numéro' };

    } catch (error) {
        console.error('❌ Erreur checkBanAPI:', error.message);
        return { status: 'unknown', message: error.message };
    }
}

// =============================================
// 2. VÉRIFICATION LOCALE (Fallback)
// =============================================
async function checkAccountLocal(socket, jid) {
    try {
        // Méthode 1: Vérifier la photo de profil
        try {
            await socket.profilePictureUrl(jid, 'image');
            return { status: 'active', method: 'photo', message: 'Compte actif' };
        } catch (e) {}

        // Méthode 2: Vérifier le statut "about"
        try {
            const status = await socket.fetchStatus(jid);
            if (status) {
                return { status: 'active', method: 'status', message: 'Compte actif' };
            }
        } catch (e) {}

        // Méthode 3: Vérifier par présence
        try {
            const presence = await socket.presenceSubscribe(jid);
            if (presence) {
                return { status: 'active', method: 'presence', message: 'Compte actif' };
            }
        } catch (e) {}

        return { status: 'unknown', message: 'Numéro introuvable' };

    } catch (error) {
        console.error('❌ Erreur locale:', error.message);
        return { status: 'unknown', message: error.message };
    }
}

// =============================================
// 3. FORMATAGE DES MESSAGES
// =============================================
function formaterMessage(status, numero, resultat, dateStr, timeStr) {
    if (status === 'banned') {
        return `
╭─✧「 🚫 *COMPTE BANNI* 🚫 」✧─╮
│
│ 👤 *Numéro :* ${numero}
│ 📌 *Statut :* ❌ Banni
│
│ ═══════════════════════
│
│ 🔒 *Ce compte a été banni par WhatsApp*
│ 📅 *Vérifié le :* ${dateStr}
│ ⏰ *Heure :* ${timeStr}
│
│ 📋 *Raison :* ${resultat.message || 'Non spécifiée'}
│
│ ⚠️ *Raisons possibles :*
│ • Spam ou comportement abusif
│ • Violation des conditions d'utilisation
│ • Signalements multiples
│
│ 🛡️ *Recommandation :*
│ Contacter le support WhatsApp
│
╰──────────✧──────────╯`;
    }

    if (status === 'active') {
        return `
╭─✧「 ✅ *COMPTE ACTIF* ✅ 」✧─╮
│
│ 👤 *Numéro :* ${numero}
│ 📌 *Statut :* ✅ Actif
│
│ ═══════════════════════
│
│ 🟢 *Ce compte est actif et accessible !*
│ 📅 *Vérifié le :* ${dateStr}
│ ⏰ *Heure :* ${timeStr}
│
│ 📡 *Vérifié via :* ${resultat.method || 'API'}
│
│ 💚 *Tout est en ordre !*
│
╰──────────✧──────────╯`;
    }

    return `
╭─✧「 ❓ *COMPTE INCONNU* ❓ 」✧─╮
│
│ 👤 *Numéro :* ${numero}
│ 📌 *Statut :* ❓ Introuvable
│
│ ═══════════════════════
│
│ ❓ *Ce numéro n'existe pas sur WhatsApp*
│ 📅 *Vérifié le :* ${dateStr}
│ ⏰ *Heure :* ${timeStr}
│
│ ⚠️ *Raisons possibles :*
│ • Le numéro n'est pas enregistré sur WhatsApp
│ • Le compte a été supprimé
│ • Le numéro est invalide
│
╰──────────✧──────────╯`;
}

// =============================================
// 4. COMMANDE PRINCIPALE .checkban
// =============================================
async function handleCheckban(socket, msg, sender, args, prefix, fakevCard, isOwner) {
    try {
        // Accusé de réception
        await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } }).catch(() => {});

        // Vérification des permissions
        if (!isOwner) {
            await socket.sendMessage(sender, {
                text: '❌ *Seul le propriétaire peut utiliser cette commande.*'
            }, { quoted: fakevCard || msg });
            return true;
        }

        // Vérification des arguments
        if (args.length === 0) {
            await socket.sendMessage(sender, {
                text: `🔍 *VÉRIFICATION DE COMPTE*\n\n📌 *Utilisation :*\n${prefix}checkban +225xxxxxxxx\n\n📝 *Exemple :*\n${prefix}checkban +2250576991050`
            }, { quoted: fakevCard || msg });
            return true;
        }

        // Nettoyer le numéro
        const targetNumber = args[0].replace(/[^0-9]/g, '');
        const targetJid = `${targetNumber}@s.whatsapp.net`;

        // Message de traitement
        await socket.sendMessage(sender, {
            text: `⏳ *VÉRIFICATION EN COURS...*\n\n👤 ${targetNumber}\n🔍 Analyse en cours...`
        }, { quoted: fakevCard || msg });

        // 🔥 Étape 1: Essayer l'API
        let resultat = await checkBanAPI(targetNumber);
        let status = resultat.status;

        // 🔥 Étape 2: Si l'API dit "unknown", utiliser la méthode locale (uniquement si socket existe)
        if (status === 'unknown' && socket) {
            console.log('🔄 API = inconnu, vérification locale...');
            const localResult = await checkAccountLocal(socket, targetJid);
            if (localResult.status !== 'unknown') {
                resultat = localResult;
                status = localResult.status;
            }
        }

        // 🔥 Étape 3: Vérifier si le numéro est valide (format WhatsApp)
        if (status === 'unknown' && targetNumber.length < 8) {
            status = 'invalid';
            resultat.message = 'Numéro invalide (trop court)';
        }

        // Date et heure
        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR');
        const timeStr = now.toLocaleTimeString('fr-FR');

        // 🔥 Étape 4: Générer le message
        const message = formaterMessage(status, targetNumber, resultat, dateStr, timeStr);

        // Envoyer le résultat
        await socket.sendMessage(sender, { text: message }, { quoted: fakevCard || msg });

        // Réaction finale
        const emoji = status === 'banned' ? '🚫' : status === 'active' ? '✅' : '❓';
        await socket.sendMessage(sender, { react: { text: emoji, key: msg.key } }).catch(() => {});

        return true;

    } catch (error) {
        console.error('❌ Erreur handleCheckban:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur :*\n${error.message}`
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }
}

// =============================================
// 5. EXPORTS
// =============================================
module.exports = { handleCheckban, checkBanAPI, checkAccountLocal };
