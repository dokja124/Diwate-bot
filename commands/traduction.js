const fetch = require('node-fetch');

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
    let translatedText = null;

    // ✅ API 1 : Google Translate (sans clé)
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            if (data && data[0] && data[0][0] && data[0][0][0]) {
                translatedText = data[0][0][0];
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
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            if (data && data.responseData && data.responseData.translatedText) {
                translatedText = data.responseData.translatedText;
                console.log('✅ MyMemory réussi');
                return translatedText;
            }
        }
    } catch (e) {
        console.log('❌ MyMemory échoué:', e.message);
    }

    // ✅ API 3 : DreadedSite
    try {
        const url = `https://api.dreaded.site/api/translate?text=${encodeURIComponent(text)}&lang=${targetLang}`;
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            if (data && data.translated) {
                translatedText = data.translated;
                console.log('✅ DreadedSite réussi');
                return translatedText;
            }
        }
    } catch (e) {
        console.log('❌ DreadedSite échoué:', e.message);
    }

    // ✅ API 4 : LibreTranslate
    try {
        const response = await fetch('https://libretranslate.com/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                q: text,
                source: 'auto',
                target: targetLang,
                format: 'text'
            })
        });
        if (response.ok) {
            const data = await response.json();
            if (data && data.translatedText) {
                translatedText = data.translatedText;
                console.log('✅ LibreTranslate réussi');
                return translatedText;
            }
        }
    } catch (e) {
        console.log('❌ LibreTranslate échoué:', e.message);
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
            // Récupérer le texte du message cité
            textToTranslate = quotedMsg.conversation ||
                              quotedMsg.extendedTextMessage?.text ||
                              quotedMsg.imageMessage?.caption ||
                              quotedMsg.videoMessage?.caption ||
                              '';

            lang = args[0] || '';
            isReply = true;
        } else {
            // Mode direct : .traduit [langue] [texte]
            if (args.length < 2) {
                const liste = Object.entries(LANGUES)
                    .map(([code, nom]) => `• ${code} - ${nom}`)
                    .join('\n');

                await socket.sendMessage(sender, {
                    text: `🌐 *TRADUCTION*\n\n` +
                          `📌 *Utilisation :*\n` +
                          `1️⃣ ${args[0] || '.'}traduit [langue] (en répondant à un message)\n` +
                          `2️⃣ ${args[0] || '.'}traduit [texte] [langue]\n\n` +
                          `📝 *Langues disponibles :*\n${liste}\n\n` +
                          `✅ *Exemples :*\n` +
                          `${args[0] || '.'}traduit fr Bonjour le monde\n` +
                          `${args[0] || '.'}traduit ja (répondre à un message)`
                }, { quoted: fakevCard || msg });
                return true;
            }

            lang = args[args.length - 1]; // Dernier argument = langue
            textToTranslate = args.slice(0, -1).join(' '); // Le reste = texte
        }

        // Vérifier les paramètres
        if (!textToTranslate || textToTranslate.trim() === '') {
            await socket.sendMessage(sender, {
                text: '❌ *Aucun texte à traduire.*\n\n📌 Répondez à un message ou écrivez le texte à traduire.'
            }, { quoted: fakevCard || msg });
            return true;
        }

        // Vérifier la langue
        if (!lang || !LANGUES[lang]) {
            const liste = Object.entries(LANGUES)
                .map(([code, nom]) => `• ${code} - ${nom}`)
                .join('\n');

            await socket.sendMessage(sender, {
                text: `❌ *Langue non reconnue :* "${lang}"\n\n📝 *Langues disponibles :*\n${liste}`
            }, { quoted: fakevCard || msg });
            return true;
        }

        // Message d'attente
        await socket.sendMessage(sender, {
            text: `🌐 *Traduction en cours...*\n\n📌 ${textToTranslate.substring(0, 50)}${textToTranslate.length > 50 ? '...' : ''}\n\n🔍 Langue cible : ${LANGUES[lang]}`
        }, { quoted: fakevCard || msg });

        // Traduire
        const translatedText = await translateText(textToTranslate, lang);

        // Envoyer le résultat
        await socket.sendMessage(sender, {
            text: `🌐 *TRADUCTION*\n\n` +
                  `📝 *Texte original :*\n${textToTranslate}\n\n` +
                  `✅ *Traduction (${LANGUES[lang]}) :*\n${translatedText}`
        }, { quoted: fakevCard || msg });

        return true;

    } catch (error) {
        console.error('❌ Erreur handleTranslate:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur de traduction :*\n${error.message}\n\n💡 Réessayez plus tard ou vérifiez la langue.`
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }
}

module.exports = { handleTraduction };
