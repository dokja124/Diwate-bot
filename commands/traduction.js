const axios = require('axios');

// Détection de langue locale (aucun appel réseau -> jamais de rate-limit)
let franc = null;
try {
    franc = require('franc-min').franc;
} catch (e) {
    console.warn('⚠️  Le module "franc-min" n\'est pas installé (npm install franc-min). La détection automatique de langue sera désactivée.');
}

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
    'créole haïtien': { code: 'ht', emoji: '🇭🇹' },
    'créole': { code: 'ht', emoji: '🇭🇹' },
    'ht': { code: 'ht', emoji: '🇭🇹' },
    'néerlandais': { code: 'nl', emoji: '🇳🇱' },
    'turc': { code: 'tr', emoji: '🇹🇷' },
    'hindi': { code: 'hi', emoji: '🇮🇳' },
    'indonésien': { code: 'id', emoji: '🇮🇩' },
    'vietnamien': { code: 'vi', emoji: '🇻🇳' },
    'thaïlandais': { code: 'th', emoji: '🇹🇭' },
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

// Correspondance ISO 639-3 (franc) -> ISO 639-1 (MyMemory / nos codes)
const FRANC_VERS_ISO1 = {
    fra: 'fr', eng: 'en', spa: 'es', jpn: 'ja', deu: 'de', ita: 'it',
    por: 'pt', cmn: 'zh', zho: 'zh', kor: 'ko', arb: 'ar', ara: 'ar',
    rus: 'ru', hat: 'ht', nld: 'nl', tur: 'tr', hin: 'hi', ind: 'id',
    vie: 'vi', tha: 'th'
};

// =============================================
// 2. DÉTECTION DE LA LANGUE SOURCE (locale, sans réseau)
// =============================================
function detecterLangue(texte) {
    if (!franc) return 'inconnue';
    try {
        const code3 = franc(texte, { minLength: 2 });
        if (code3 === 'und') return 'inconnue'; // langue indéterminée
        return FRANC_VERS_ISO1[code3] || 'inconnue';
    } catch (error) {
        return 'inconnue';
    }
}

// =============================================
// 3. FONCTION DE TRADUCTION (API MyMemory)
// =============================================
async function traduireTexte(texte, langueCible, langueSourceDetectee) {
    // MyMemory exige un code source explicite (pas de vrai "auto" côté serveur)
    const source = (langueSourceDetectee && langueSourceDetectee !== 'inconnue' && langueSourceDetectee !== langueCible)
        ? langueSourceDetectee
        : (langueCible === 'en' ? 'fr' : 'en'); // repli raisonnable si détection incertaine

    try {
        const url = `https://api.mymemory.translated.net/get`;
        const response = await axios.get(url, {
            timeout: 10000,
            params: {
    q: texte,
    langpair: `${source}|${langueCible}`,
    de: 'malandaniel250@gmail.com' 
},
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const data = response.data;
        const texteTraduit = data?.responseData?.translatedText;

        if (!texteTraduit || texteTraduit.trim() === '') {
            throw new Error('Traduction vide (réponse MyMemory inattendue: ' + JSON.stringify(data).slice(0, 200) + ')');
        }

        // MyMemory renvoie parfois un message d'erreur DANS translatedText avec un status 403 dans le JSON
        if (data.responseStatus && Number(data.responseStatus) >= 400) {
            throw new Error(`MyMemory a renvoyé une erreur (${data.responseStatus}): ${texteTraduit}`);
        }

        return texteTraduit;
    } catch (error) {
        const status = error.response?.status;
        const body = error.response?.data ? JSON.stringify(error.response.data).slice(0, 300) : '';
        console.error('Erreur traduction:', error.message, status ? `[HTTP ${status}]` : '', body);
        throw new Error(`Impossible de traduire le texte${status ? ` (HTTP ${status})` : ''}: ${error.message}`);
    }
}

// =============================================
// 4. GÉNÉRER LA LISTE DES LANGUES
// =============================================
function getListeLangues() {
    const noms = Object.keys(LANGUES)
        .filter(key => key.length > 3)
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

        let langueKey = args[0];
        let texte = '';
        let indexDebut = 1;

        if (args[0].toLowerCase() === 'en' && args.length > 1) {
            langueKey = args[1];
            indexDebut = 2;
        }

        texte = args.slice(indexDebut).join(' ');

        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quotedMsg && (!texte || texte.trim() === '')) {
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

        const langueInfo = LANGUES[langueKey.toLowerCase()];
        if (!langueInfo) {
            const liste = getListeLangues();
            await socket.sendMessage(sender, {
                text: `❌ *Langue non reconnue :* "${langueKey}"\n\n📝 *Langues disponibles :*\n${liste}`
            }, { quoted: fakevCard });
            return true;
        }

        if (!texte || texte.trim() === '') {
            await socket.sendMessage(sender, {
                text: `❌ *Texte vide !*\n\n📌 *Usage :* ${prefix}traduit ${langueKey} [texte à traduire]`
            }, { quoted: fakevCard });
            return true;
        }

        await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } }).catch(() => {});

        const langueSource = detecterLangue(texte); // local, instantané, jamais de rate-limit
        const texteTraduit = await traduireTexte(texte, langueInfo.code, langueSource);

        let sourceNom = langueSource;
        for (const [nom, info] of Object.entries(LANGUES)) {
            if (info.code === langueSource) {
                sourceNom = nom;
                break;
            }
        }

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
    
