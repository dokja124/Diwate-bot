const axios = require('axios');

// =============================================
// 1. LANGUES DISPONIBLES
// =============================================
const LANGUES = {
    'français': { code: 'fr', emoji: '🇫🇷' },
    'anglais': { code: 'en', emoji: '🇬🇧' },
    'espagnol': { code: 'es', emoji: '🇪🇸' },
    'japonais': { code: 'ja', emoji: '🇯🇵' },
    'allemand': { code: 'de', emoji: '🇩🇪' },
    'italien': { code: 'it', emoji: '🇮🇹' },
    'portugais': { code: 'pt', emoji: '🇵🇹' },
    'chinois': { code: 'zh', emoji: '🇨🇳' },
    'coréen': { code: 'ko', emoji: '🇰🇷' },
    'arabe': { code: 'ar', emoji: '🇸🇦' },
    'russe': { code: 'ru', emoji: '🇷🇺' },
    'créole haïtien': { code: 'ht', emoji: '🇭🇹' }, // ✅ Créole haïtien
    'créole': { code: 'ht', emoji: '🇭🇹' },
    'ht': { code: 'ht', emoji: '🇭🇹' },
    'néerlandais': { code: 'nl', emoji: '🇳🇱' },
    'turc': { code: 'tr', emoji: '🇹🇷' },
    'hindi': { code: 'hi', emoji: '🇮🇳' },
    'indonésien': { code: 'id', emoji: '🇮🇩' },
    'vietnamien': { code: 'vi', emoji: '🇻🇳' },
    'thaïlandais': { code: 'th', emoji: '🇹🇭' },
    // Codes ISO (pour les raccourcis)
    'fr': { code: 'fr', emoji: '🇫🇷' },
    'en': { code: 'en', emoji: '🇬🇧' },
    'es': { code: 'es', emoji: '🇪🇸' },
    'ja': { code: 'ja', emoji: '🇯🇵' },
    'de': { code: 'de', emoji: '🇩🇪' },
    'it': { code: 'it', emoji: '🇮🇹' },
    'pt': { code: 'pt', emoji: '🇵🇹' },
    'zh': { code: 'zh', emoji: '🇨🇳' },
    'ko': { code: 'ko', emoji: '🇰🇷' },
    'ar': { code: 'ar', emoji: '🇸🇦' },
    'ru': { code: 'ru', emoji: '🇷🇺' },
};

// =============================================
// 2. FONCTION DE TRADUCTION (API Google)
// =============================================
async function traduireTexte(texte, langueCible) {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=auto&tl=${langueCible}&q=${encodeURIComponent(texte)}`;
        
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const data = response.data;
        
        // Extraire le texte traduit
        let texteTraduit = '';
        if (data && data[0]) {
            for (const segment of data[0]) {
                if (segment[0]) {
                    texteTraduit += segment[0];
                }
            }
        }
        
        if (!texteTraduit || texteTraduit.trim() === '') {
            throw new Error('Traduction vide (réponse Google inattendue: ' + JSON.stringify(data).slice(0, 200) + ')');
        }
        
        return texteTraduit;
    } catch (error) {
        // Log détaillé pour diagnostiquer la vraie cause (statut HTTP, timeout, etc.)
        const status = error.response?.status;
        const body = error.response?.data ? JSON.stringify(error.response.data).slice(0, 300) : '';
        console.error('Erreur traduction:', error.message, status ? `[HTTP ${status}]` : '', body);
        throw new Error(`Impossible de traduire le texte${status ? ` (HTTP ${status})` : ''}: ${error.message}`);
    }
}

// =============================================
// 3. DÉTECTION DE LA LANGUE SOURCE
// =============================================
async function detecterLangue(texte) {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=ld&sl=auto&tl=fr&q=${encodeURIComponent(texte)}`;
        
        const response = await axios.get(url, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const data = response.data;
        if (data && data[2]) {
            return data[2];
        }
        return 'inconnue';
    } catch (error) {
        return 'inconnue';
    }
}

// =============================================
// 4. GÉNÉRER LA LISTE DES LANGUES
// =============================================
function getListeLangues() {
    const noms = Object.keys(LANGUES)
        .filter(key => key.length > 3) // Filtrer les codes ISO (fr, en, etc.)
        .sort();
    
    return noms.map(nom => {
        const info = LANGUES[nom];
        return `${info.emoji} ${nom.charAt(0).toUpperCase() + nom.slice(1)}`;
    }).join('\n');
}

// =============================================
// 5. COMMANDE PRINCIPALE .traduit
// =============================================
async function handleTraduction(socket, msg, sender, args, prefix, fakevCard, isOwner) {
    try {
        // =============================================
        // CAS 1 : Pas d'arguments → Demander la langue
        // =============================================
        if (args.length === 0) {
            const liste = getListeLangues();
            const message = `🌐 *TRADUCTION*\n\n` +
                `📌 *Utilisation :*\n` +
                `1️⃣ ${prefix}traduit [langue] [texte]\n` +
                `2️⃣ ${prefix}traduit [langue] (en répondant à un message)\n\n` +
                `📝 *Langues disponibles :*\n${liste}\n\n` +
                `✅ *Exemples :*\n` +
                `${prefix}traduit créole Bonjour tout le monde\n` +
                `${prefix}traduit en japonais Comment ça va ?\n` +
                `${prefix}traduit ht (répondre à un message)`;
            
            await socket.sendMessage(sender, { text: message }, { quoted: fakevCard });
            return true;
        }

        // =============================================
        // CAS 2 : Vérifier si le premier argument est "en"
        // =============================================
        let langueKey = args[0];
        let texte = '';
        let indexDebut = 1;

        // Si le premier mot est "en", on prend le suivant comme langue
        if (args[0].toLowerCase() === 'en' && args.length > 1) {
            langueKey = args[1];
            indexDebut = 2;
        }

        // Récupérer le texte
        texte = args.slice(indexDebut).join(' ');

        // =============================================
        // CAS 3 : Si c'est une réponse à un message
        // =============================================
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quotedMsg && (!texte || texte.trim() === '')) {
            // Récupérer le texte du message cité
            if (quotedMsg.conversation) {
                texte = quotedMsg.conversation;
            } else if (quotedMsg.extendedTextMessage?.text) {
                texte = quotedMsg.extendedTextMessage.text;
            } else {
                await socket.sendMessage(sender, { 
                    text: '❌ *Impossible de traduire ce type de message.*' 
                }, { quoted: fakevCard });
                return true;
            }
        }

        // =============================================
        // CAS 4 : Vérifier la langue
        // =============================================
        const langueInfo = LANGUES[langueKey.toLowerCase()];
        if (!langueInfo) {
            const liste = getListeLangues();
            await socket.sendMessage(sender, { 
                text: `❌ *Langue non reconnue :* "${langueKey}"\n\n📝 *Langues disponibles :*\n${liste}` 
            }, { quoted: fakevCard });
            return true;
        }

        // =============================================
        // CAS 5 : Vérifier le texte
        // =============================================
        if (!texte || texte.trim() === '') {
            await socket.sendMessage(sender, { 
                text: `❌ *Texte vide !*\n\n📌 *Usage :* ${prefix}traduit ${langueKey} [texte à traduire]` 
            }, { quoted: fakevCard });
            return true;
        }

        // =============================================
        // CAS 6 : Effectuer la traduction
        // =============================================
        await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } }).catch(() => {});

        const texteTraduit = await traduireTexte(texte, langueInfo.code);
        const langueSource = await detecterLangue(texte);

        // Trouver le nom de la langue source
        let sourceNom = langueSource;
        for (const [nom, info] of Object.entries(LANGUES)) {
            if (info.code === langueSource) {
                sourceNom = nom;
                break;
            }
        }

        // =============================================
        // CAS 7 : Envoyer le résultat
        // =============================================
        const message = `🌐 *TRADUCTION*\n\n` +
            `📝 *Texte original :*\n${texte}\n\n` +
            `✅ *Traduction (${langueInfo.emoji} ${langueKey}) :*\n${texteTraduit}\n\n` +
            `🔍 *Langue source :* ${sourceNom}`;

        await socket.sendMessage(sender, { text: message }, { quoted: fakevCard });
        return true;

    } catch (error) {
        console.error('Erreur handleTraduction:', error.message);
        await socket.sendMessage(sender, { 
            text: `❌ *Erreur de traduction :*\n${error.message}` 
        }, { quoted: fakevCard });
        return true;
    }
}

// =============================================
// 6. EXPORTS
// =============================================
module.exports = { 
    handleTraduction, 
    LANGUES, 
    getListeLangues, 
    traduireTexte,
    detecterLangue
};
           
