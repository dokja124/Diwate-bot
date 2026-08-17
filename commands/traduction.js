const axios = require('axios');

// =============================================
// 1. LANGUES DISPONIBLES
// =============================================

const LANGUES = {
    'fr': 'Français',
    'en': 'Anglais',
    'es': 'Espagnol',
    'de': 'Allemand',
    'it': 'Italien',
    'pt': 'Portugais',
    'ru': 'Russe',
    'ja': 'Japonais',
    'ko': 'Coréen',
    'zh': 'Chinois',
    'ar': 'Arabe',
    'hi': 'Hindi',
    'nl': 'Néerlandais',
    'tr': 'Turc',
    'vi': 'Vietnamien',
    'th': 'Thaïlandais',
    'ht': 'Créole Haïtien',
    'id': 'Indonésien'
};

// =============================================
// 2. TRADUCTION
// =============================================

async function translateText(text, targetLang) {
    // ✅ API 1 : Google Translate (sans clé)
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        if (response.data && response.data[0]) {
            // Google renvoie un tableau de morceaux, il faut tout concaténer
            let translatedText = '';
            for (let chunk of response.data[0]) {
                if (chunk[0]) translatedText += chunk[0];
            }
            if (translatedText) {
                console.log('✅ Google Translate réussi');
                return translatedText;
            }
        }
    } catch (e) {
        console.log('❌ Google Translate échoué:', e.message);
    }

    // ✅ API 2 : MyMemory
    try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${targetLang}`;
        const response = await axios.get(url);
        if (response.data && response.data.responseData && response.data.responseData.translatedText) {
            console.log('✅ MyMemory réussi');
            return response.data.responseData.translatedText;
        }
    } catch (e) {
        console.log('❌ MyMemory échoué:', e.message);
    }

    // ✅ API 3 : Lingva (Alternative très fiable à Google)
    try {
        const url = `https://lingva.ml/api/v1/auto/${targetLang}/${encodeURIComponent(text)}`;
        const response = await axios.get(url);
        if (response.data && response.data.translation) {
            console.log('✅ Lingva réussi');
            return response.data.translation;
        }
    } catch (e) {
        console.log('❌ Lingva échoué:', e.message);
    }

    throw new Error('Tous les services de traduction ont échoué');
}

// =============================================
// 3. COMMANDE PRINCIPALE .traduit
// =============================================

async function handleTraduction(socket, msg, sender, args, fakevCard) {
    try {
        // ✅ Réaction
        await socket.sendMessage(sender, { react: { text: '🌐', key: msg.key } }).catch(() => {});

        let textToTranslate = '';
        let lang = '';
        let isReply = false;

        // Vérifier si c'est une réponse à un message
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quotedMsg) {
            textToTranslate = quotedMsg.conversation ||
                              quotedMsg.extendedTextMessage?.text ||
                              quotedMsg.imageMessage?.caption ||
                              quotedMsg.videoMessage?.caption ||
                              '';

            lang = args[0] || '';
            isReply = true;
        } else {
            // Mode direct : .traduit [langue] [texte] OU .traduit [texte] [langue]
            if (args.length < 2) {
                const liste = Object.entries(LANGUES)
                    .map(([code, nom]) => `• ${code} - ${nom}`)
                    .join('\n');

                await socket.sendMessage(sender, {
                    text: `🌐 *TRADUCTION*\n\n` +
                          `📌 *Utilisation :*\n` +
                          `1️⃣ .traduit [langue] (en répondant à un message)\n` +
                          `2️⃣ .traduit [langue] [texte]\n` +
                          `3️⃣ .traduit [texte] [langue]\n\n` +
                          `📝 *Langues disponibles :*\n${liste}\n\n` +
                          `✅ *Exemples :*\n` +
                          `.traduit fr Bonjour le monde\n` +
                          `.traduit Bonjour le monde fr\n` +
                          `.traduit ja (en répondant à un message)`
                }, { quoted: fakevCard || msg });
                return true;
            }

            // LOGIQUE INTELLIGENTE : On vérifie si le 1er ou le dernier argument est une langue
            const firstArg = args[0].toLowerCase();
            const lastArg = args[args.length - 1].toLowerCase();

            if (LANGUES[firstArg]) {
                lang = firstArg;
                textToTranslate = args.slice(1).join(' ');
            } else if (LANGUES[lastArg]) {
                lang = lastArg;
                textToTranslate = args.slice(0, -1).join(' ');
            } else {
                lang = firstArg; // Pour déclencher l'erreur de langue ci-dessous
                textToTranslate = args.join(' ');
            }
        }

        // Vérifier les paramètres
        if (!textToTranslate || textToTranslate.trim() === '') {
            await socket.sendMessage(sender, {
                text: '❌ *Aucun texte à traduire.*\n\n📌 Répondez à un message ou écrivez le texte à traduire.'
            }, { quoted: fakevCard || msg });
            return true;
        }

        // Vérifier la langue
        if (!lang || !LANGUES[lang.toLowerCase()]) {
            const liste = Object.entries(LANGUES)
                .map(([code, nom]) => `• ${code} - ${nom}`)
                .join('\n');

            await socket.sendMessage(sender, {
                text: `❌ *Langue non reconnue :* "${lang}"\n\n📝 *Langues disponibles :*\n${liste}`
            }, { quoted: fakevCard || msg });
            return true;
        }

        lang = lang.toLowerCase(); // Sécurité supplémentaire

        // Message d'attente
        await socket.sendMessage(sender, {
            text: `🌐 *Traduction en cours...*\n\n🔍 Langue cible : ${LANGUES[lang]}`
        }, { quoted: fakevCard || msg });

        // Traduire
        const translatedText = await translateText(textToTranslate, lang);

        // Envoyer le résultat
        await socket.sendMessage(sender, {
            text: `🌐 *TRADUCTION*\n\n` +
                  `📝 *Texte original :*\n${textToTranslate}\n\n` +
                  `✅ *Traduction (${LANGUES[lang]}) :*\n${translatedText}`
        }, { quoted: fakevCard || msg });

        // ✅ Réaction de succès
        await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }).catch(() => {});

        return true;

    } catch (error) {
        console.error('❌ Erreur handleTranslate:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur de traduction :*\n${error.message}\n\n💡 Réessayez plus tard ou vérifiez la langue.`
        }, { quoted: fakevCard || msg }).catch(() => {});
        
        // ❌ Réaction d'erreur
        await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }).catch(() => {});
        return true;
    }
}

module.exports = { handleTraduction };
