

const axios = require('axios');

// =============================================
// 1. VÉRIFIER VIA L'API (silencieuse)
// =============================================
async function checkBanAPI(numero) {
    try {
        const url = `https://banchek-by-awais.kesug.com/bancheck.php?numero=${numero}`;
        console.log(`🔍 API check: ${numero}`);
        
        const response = await axios.get(url, {
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        console.log('📊 API réponse:', response.data);

        if (response.data && response.data.error === false) {
            return { status: 'active' };
        } else if (response.data && response.data.error === true) {
            const msg = response.data.message || '';
            if (msg.toLowerCase().includes('ban') || 
                msg.toLowerCase().includes('banned') ||
                msg.toLowerCase().includes('not')) {
                return { status: 'banned' };
            }
            return { status: 'unknown' };
        }

        return { status: 'unknown' };

    } catch (error) {
        console.error('❌ API erreur:', error.message);
        return { status: 'error' };
    }
}

// =============================================
// 2. MÉTHODE DE SECOURS (silencieuse)
// =============================================
async function checkAccountLocal(socket, jid) {
    try {
        await socket.sendMessage(jid, { text: '🔍' });
        return { status: 'active' };
    } catch (error) {
        const errMsg = error.message || '';
        if (errMsg.includes('not-authorized') || 
            errMsg.includes('banned') ||
            errMsg.includes('blocked')) {
            return { status: 'banned' };
        }
        return { status: 'unknown' };
    }
}

// =============================================
// 3. COMMANDE PRINCIPALE .checkban
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

        // 3. Message de vérification (simple)
        await socket.sendMessage(sender, {
            text: `🔍 *VÉRIFICATION EN COURS...*`
        }, { quoted: fakevCard || msg });

        // 4. Vérifier via l'API (en arrière-plan)
        let result = await checkBanAPI(targetNumber);

        // 5. Si l'API échoue, utiliser la méthode locale (en arrière-plan)
        if (result.status === 'error') {
            result = await checkAccountLocal(socket, targetJid);
        }

        // 6. Message stylé selon le résultat (UNIQUEMENT le résultat)
        let message = '';
        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR');
        const timeStr = now.toLocaleTimeString('fr-FR');
        
        if (result.status === 'banned') {
            message = `
╭─✧「 🚫 *COMPTE BANNI* 🚫 」✧─╮
│
│ 👤 *Numéro :* ${targetNumber}
│ 📌 *Statut :* ❌ Banni
│
│ ═══════════════════════
│
│ 🔒 *Ce compte a été banni par WhatsApp*
│ 📅 *Vérifié le :* ${dateStr}
│ ⏰ *Heure :* ${timeStr}
│
│ ⚠️ *Raisons possibles :*
│ • Spam ou comportement abusif
│ • Violation des conditions d'utilisation
│ • Signalements multiples
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
│ 📌 *Statut :* ✅ Actif
│
│ ═══════════════════════
│
│ 🟢 *Ce compte est actif et accessible !*
│ 📅 *Vérifié le :* ${dateStr}
│ ⏰ *Heure :* ${timeStr}
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
