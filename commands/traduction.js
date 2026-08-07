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
    'français': { code: 'fr', emoji: '🇫🇷', nomAnglais: 'French' },
    'anglais': { code: 'en', emoji: '🇬🇧', nomAnglais: 'English' },
    'espagnol': { code: 'es', emoji: '🇪🇸', nomAnglais: 'Spanish' },
    'japonais': { code: 'ja', emoji: '🇯🇵', nomAnglais: 'Japanese' },
    'allemand': { code: 'de', emoji: '🇩🇪', nomAnglais: 'German' },
    'italien': { code: 'it', emoji: '🇮🇹', nomAnglais: 'Italian' },
    'portugais': { code: 'pt', emoji: '🇵🇹', nomAnglais: 'Portuguese' },
    'chinois': { code: 'zh', emoji: '🇨🇳', nomAnglais: 'Chinese' },
    'coréen': { code: 'ko', emoji: '🇰🇷', nomAnglais: 'Korean' },
    'arabe': { code: 'ar', emoji: '🇸🇦', nomAnglais: 'Arabic' },
    'russe': { code: 'ru', emoji: '🇷🇺', nomAnglais: 'Russian' },
    'créole haïtien': { code: 'ht', emoji: '🇭🇹', nomAnglais: 'Haitian Creole' },
    'créole': { code: 'ht', emoji: '🇭🇹', nomAnglais: 'Haitian Creole' },
    'ht': { code: 'ht', emoji: '🇭🇹', nomAnglais: 'Haitian Creole' },
    'néerlandais': { code: 'nl', emoji: '🇳🇱', nomAnglais: 'Dutch' },
    'turc': { code: 'tr', emoji: '🇹🇷', nomAnglais: 'Turkish' },
    'hindi': { code: 'hi', emoji: '🇮🇳', nomAnglais: 'Hindi' },
    'indonésien': { code: 'id', emoji: '🇮🇩', nomAnglais: 'Indonesian' },
    'vietnamien': { code: 'vi', emoji: '🇻🇳', nomAnglais: 'Vietnamese' },
    'thaïlandais': { code: 'th', emoji: '🇹🇭', nomAnglais: 'Thai' },
    'fr': { code: 'fr', emoji: '🇫🇷', nomAnglais: 'French' },
    'en': { code: 'en', emoji: '🇬🇧', nomAnglais: 'English' },
    'es': { code: 'es', emoji: '🇪🇸', nomAnglais: 'Spanish' },
    'ja': { code: 'ja', emoji: '🇯🇵', nomAnglais: 'Japanese' },
    'de': { code: 'de', emoji: '🇩🇪', nomAnglais: 'German' },
    'it': { code: 'it', emoji: '🇮🇹', nomAnglais: 'Italian' },
    'pt': { code: 'pt', emoji: '🇵🇹', nomAnglais: 'Portuguese' },
    'zh': { code: 'zh', emoji: '🇨🇳', nomAnglais: 'Chinese' },
    'ko': { code: 'ko', emoji: '🇰🇷', nomAnglais: 'Korean' },
    'ar': { code: 'ar', emoji: '🇸🇦', nomAnglais: 'Arabic' },
    'ru': { code: 'ru', emoji: '🇷🇺', nomAnglais: 'Russian' },
};

// Correspondance ISO 639-3 (franc) -> ISO 639-1
const FRANC_VERS_ISO1 = {
    fra: 'fr', eng: 'en', spa: 'es', jpn: 'ja', deu: 'de', ita: 'it',
    por: 'pt', cmn: 'zh', zho: 'zh', kor: 'ko', arb: 'ar', ara: 'ar',
    rus: 'ru', hat: 'ht', nld: 'nl', tur: 'tr', hin: 'hi', ind: 'id',
    vie: 'vi', tha: 'th'
};

// ⚠️ Clé Gemini (Google AI Studio) - gratuite, sans carte bancaire
// Idéalement mets-la en variable d'environnement GEMINI_API_KEY sur Render (Settings > Environment)
// plutôt que de la laisser en dur ici si ton repo GitHub devient public un jour.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AQ.Ab8RN6Iwt4xMn0idc_kMhz2q1j7yWLKPrHmdsH3m2r4jzm5-6w';
const GEMINI_MODEL = 'gemini-2.5-flash';

// Email pour augmenter le quota MyMemory (solution de secours)
const EMAIL_MYMEMORY = 'malandaniel250@gmail.com';

// =============================================
// 2. DÉTECTION DE LA LANGUE SOURCE (locale, sans réseau)
// =============================================
function detecterLangue(texte) {
    if (!franc) return 'inconnue';
    try {
        const code3 = franc(texte, { minLength: 2 });
        if (code3 === 'und') return 'inconnue';
        return FRANC_VERS_ISO1[code3] || 'inconnue';
    } catch (error) {
        return 'inconnue';
    }
}

// =============================================
// 3. FOURNISSEURS DE TRADUCTION (essayés dans l'ordre)
// =============================================

async function viaGemini(texte, source, cible, nomLangueCibleAnglais) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const prompt = `Translate the following text to ${nomLangueCibleAnglais}. Reply with ONLY the translation, no explanations, no quotation marks, no extra text.\n\nText: ${texte}`;

    const response = await axios.post(url, {
        contents: [{ parts: [{ text: prompt }] }]
    }, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' }
    });

    const texteTraduit = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!texteTraduit || texteTraduit.trim() === '') throw new Error('Gemini: réponse vide');
    return texteTraduit.trim().replace(/^["']|["']$/g, '');
}

async function viaMyMemory(texte, source, cible) {
    const response = await axios.get('https://api.mymemory.translated.net/get', {
        timeout: 8000,
        params: { q: texte, langpair: `${source}|${cible}`, de: EMAIL_MYMEMORY },
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const data = response.data;
    if (data.responseStatus && Number(data.responseStatus) >= 400) {
        throw new Error(`MyMemory: ${data.responseData?.translatedText || data.responseStatus}`);
    }
    const texteTraduit = data?.responseData?.translatedText;
    if (!texteTraduit || texteTraduit.trim() === '') throw new Error('MyMemory: réponse vide');
    return texteTraduit;
}

async function viaLingva(texte, source, cible) {
    const src = source === 'inconnue' ? 'auto' : source;
    const url = `https://lingva.ml/api/v1/${src}/${cible}/${encodeURIComponent(texte)}`;
    const response = await axios.get(url, { timeout: 8000 });
    const texteTraduit = response.data?.translation;
    if (!texteTraduit || texteTraduit.trim() === '') throw new Error('Lingva: réponse vide');
    return texteTraduit;
}

/**
 * Essaie chaque fournisseur dans l'ordre jusqu'à ce qu'un fonctionne.
 * Gemini en premier (clé personnelle, pas de blocage IP partagée),
 * puis MyMemory et Lingva en secours si Gemini est indisponible.
 */
async function traduireTexte(texte, langueCible, langueSourceDetectee, nomLangueCibleAnglais) {
    const source = (langueSourceDetectee && langueSourceDetectee !== 'inconnue' && langueSourceDetectee !== langueCible)
        ? langueSourceDetectee
        : (langueCible === 'en' ? 'fr' : 'en');

    const fournisseurs = [
        { nom: 'Gemini', fn: () => viaGemini(texte, source, langueCible, nomLangueCibleAnglais) },
        { nom: 'MyMemory', fn: () => viaMyMemory(texte, source, langueCible) },
        { nom: 'Lingva', fn: () => viaLingva(texte, source, langueCible) },
    ];

    const erreurs = [];
    for (const { nom, fn } of fournisseurs) {
        try {
            return await fn();
        } catch (error) {
            const status = error.response?.status;
            erreurs.push(`${nom}${status ? ` (HTTP ${status})` : ''}: ${error.message}`);
            console.error(`Échec ${nom}:`, error.message);
        }
    }

    throw new Error(`Tous les services de traduction ont échoué.\n${erreurs.join('\n')}`);
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

        const langueSource = detecterLangue(texte);
        const texteTraduit = await traduireTexte(texte, langueInfo.code, langueSource, langueInfo.nomAnglais);

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
        
