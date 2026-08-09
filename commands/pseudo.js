/**
 * pseudo.js — Commande .pseudo : génère un pseudo stylé avec des caractères spéciaux
 * 
 * Comment l'intégrer dans pair.js :
 * ----------------------------------
 * 1. En haut de pair.js, ajoute :
 *      const { handlePseudo } = require('./pseudo');
 * 
 * 2. Dans le switch(command), ajoute :
 *      case 'pseudo':
 *      case 'pseudos': {
 *          await handlePseudo(socket, msg, sender, args, fakevCard);
 *          break;
 *      }
 */

// =============================================
// 1. STYLES DE PSEUDOS
// =============================================

const STYLES = {
    // Style 1: ➻𒍜➻Nom▒̿ =ε/̵͇̿̿̿̿ ̿ ̿ ̿ ̿ ̿
    'cyber': (nom) => {
        const symbols = ['➻', '𒍜', '▒̿', '=ε/̵͇̿̿̿̿', ' ̿', ' ̿', ' ̿', ' ̿', ' ̿'];
        return `${symbols[0]}${symbols[1]}${symbols[0]}${nom}${symbols[2]}${symbols[3]}${symbols[4]}${symbols[5]}${symbols[6]}${symbols[7]}${symbols[8]}`;
    },

    // Style 2: ꧁༺Nom༻꧂
    'elegant': (nom) => {
        return `꧁༺${nom}༻꧂`;
    },

    // Style 3: ╚═══╗Nom╔═══╝
    'box': (nom) => {
        return `╚═══╗${nom}╔═══╝`;
    },

    // Style 4: 🔥 Nom 🔥
    'fire': (nom) => {
        return `🔥 ${nom} 🔥`;
    },

    // Style 5: 【Ｎｏｍ】
    'wide': (nom) => {
        const wideChars = {
            'A': 'Ａ', 'B': 'Ｂ', 'C': 'Ｃ', 'D': 'Ｄ', 'E': 'Ｅ',
            'F': 'Ｆ', 'G': 'Ｇ', 'H': 'Ｈ', 'I': 'Ｉ', 'J': 'Ｊ',
            'K': 'Ｋ', 'L': 'Ｌ', 'M': 'Ｍ', 'N': 'Ｎ', 'O': 'Ｏ',
            'P': 'Ｐ', 'Q': 'Ｑ', 'R': 'Ｒ', 'S': 'Ｓ', 'T': 'Ｔ',
            'U': 'Ｕ', 'V': 'Ｖ', 'W': 'Ｗ', 'X': 'Ｘ', 'Y': 'Ｙ',
            'Z': 'Ｚ', 'a': 'ａ', 'b': 'ｂ', 'c': 'ｃ', 'd': 'ｄ',
            'e': 'ｅ', 'f': 'ｆ', 'g': 'ｇ', 'h': 'ｈ', 'i': 'ｉ',
            'j': 'ｊ', 'k': 'ｋ', 'l': 'ｌ', 'm': 'ｍ', 'n': 'ｎ',
            'o': 'ｏ', 'p': 'ｐ', 'q': 'ｑ', 'r': 'ｒ', 's': 'ｓ',
            't': 'ｔ', 'u': 'ｕ', 'v': 'ｖ', 'w': 'ｗ', 'x': 'ｘ',
            'y': 'ｙ', 'z': 'ｚ'
        };
        const wide = nom.split('').map(c => wideChars[c] || c).join('');
        return `【${wide}】`;
    },

    // Style 6: 𝓝𝓸𝓶
    'cursive': (nom) => {
        const cursiveChars = {
            'A': '𝓐', 'B': '𝓑', 'C': '𝓒', 'D': '𝓓', 'E': '𝓔',
            'F': '𝓕', 'G': '𝓖', 'H': '𝓗', 'I': '𝓘', 'J': '𝓙',
            'K': '𝓚', 'L': '𝓛', 'M': '𝓜', 'N': '𝓝', 'O': '𝓞',
            'P': '𝓟', 'Q': '𝓠', 'R': '𝓡', 'S': '𝓢', 'T': '𝓣',
            'U': '𝓤', 'V': '𝓥', 'W': '𝓦', 'X': '𝓧', 'Y': '𝓨',
            'Z': '𝓩', 'a': '𝓪', 'b': '𝓫', 'c': '𝓬', 'd': '𝓭',
            'e': '𝓮', 'f': '𝓯', 'g': '𝓰', 'h': '𝓱', 'i': '𝓲',
            'j': '𝓳', 'k': '𝓴', 'l': '𝓵', 'm': '𝓶', 'n': '𝓷',
            'o': '𝓸', 'p': '𝓹', 'q': '𝓺', 'r': '𝓻', 's': '𝓼',
            't': '𝓽', 'u': '𝓾', 'v': '𝓿', 'w': '𝔀', 'x': '𝔁',
            'y': '𝔂', 'z': '𝔃'
        };
        return nom.split('').map(c => cursiveChars[c] || c).join('');
    },

    // Style 7: 𝕹𝖔𝖒
    'double': (nom) => {
        const doubleChars = {
            'A': '𝔸', 'B': '𝔹', 'C': 'ℂ', 'D': '𝔻', 'E': '𝔼',
            'F': '𝔽', 'G': '𝔾', 'H': 'ℍ', 'I': '𝕀', 'J': '𝕁',
            'K': '𝕂', 'L': '𝕃', 'M': '𝕄', 'N': 'ℕ', 'O': '𝕆',
            'P': 'ℙ', 'Q': 'ℚ', 'R': 'ℝ', 'S': '𝕊', 'T': '𝕋',
            'U': '𝕌', 'V': '𝕍', 'W': '𝕎', 'X': '𝕏', 'Y': '𝕐',
            'Z': 'ℤ', 'a': '𝕒', 'b': '𝕓', 'c': '𝕔', 'd': '𝕕',
            'e': '𝕖', 'f': '𝕗', 'g': '𝕘', 'h': '𝕙', 'i': '𝕚',
            'j': '𝕛', 'k': '𝕜', 'l': '𝕝', 'm': '𝕞', 'n': '𝕟',
            'o': '𝕠', 'p': '𝕡', 'q': '𝕢', 'r': '𝕣', 's': '𝕤',
            't': '𝕥', 'u': '𝕦', 'v': '𝕧', 'w': '𝕨', 'x': '𝕩',
            'y': '𝕪', 'z': '𝕫'
        };
        return nom.split('').map(c => doubleChars[c] || c).join('');
    },

    // Style 8: N̸o̸m̸
    'strike': (nom) => {
        return nom.split('').join('̸') + '̸';
    },

    // Style 9: N̶o̶m̶
    'strike2': (nom) => {
        return nom.split('').join('̶') + '̶';
    },

    // Style 10: N̲o̲m̲
    'underline': (nom) => {
        return nom.split('').join('̲') + '̲';
    },

    // Style 11: Ṅȯṁ
    'dot': (nom) => {
        return nom.split('').join('̇') + '̇';
    },

    // Style 12: 𝐍𝐨𝐦
    'bold': (nom) => {
        const boldChars = {
            'A': '𝐀', 'B': '𝐁', 'C': '𝐂', 'D': '𝐃', 'E': '𝐄',
            'F': '𝐅', 'G': '𝐆', 'H': '𝐇', 'I': '𝐈', 'J': '𝐉',
            'K': '𝐊', 'L': '𝐋', 'M': '𝐌', 'N': '𝐍', 'O': '𝐎',
            'P': '𝐏', 'Q': '𝐐', 'R': '𝐑', 'S': '𝐒', 'T': '𝐓',
            'U': '𝐔', 'V': '𝐕', 'W': '𝐖', 'X': '𝐗', 'Y': '𝐘',
            'Z': '𝐙', 'a': '𝐚', 'b': '𝐛', 'c': '𝐜', 'd': '𝐝',
            'e': '𝐞', 'f': '𝐟', 'g': '𝐠', 'h': '𝐡', 'i': '𝐢',
            'j': '𝐣', 'k': '𝐤', 'l': '𝐥', 'm': '𝐦', 'n': '𝐧',
            'o': '𝐨', 'p': '𝐩', 'q': '𝐪', 'r': '𝐫', 's': '𝐬',
            't': '𝐭', 'u': '𝐮', 'v': '𝐯', 'w': '𝐰', 'x': '𝐱',
            'y': '𝐲', 'z': '𝐳'
        };
        return nom.split('').map(c => boldChars[c] || c).join('');
    },

    // Style 13: 𝙽𝚘𝚖
    'mono': (nom) => {
        const monoChars = {
            'A': '𝙰', 'B': '𝙱', 'C': '𝙲', 'D': '𝙳', 'E': '𝙴',
            'F': '𝙵', 'G': '𝙶', 'H': '𝙷', 'I': '𝙸', 'J': '𝙹',
            'K': '𝙺', 'L': '𝙻', 'M': '𝙼', 'N': '𝙽', 'O': '𝙾',
            'P': '𝙿', 'Q': '𝚀', 'R': '𝚁', 'S': '𝚂', 'T': '𝚃',
            'U': '𝚄', 'V': '𝚅', 'W': '𝚆', 'X': '𝚇', 'Y': '𝚈',
            'Z': '𝚉', 'a': '𝚊', 'b': '𝚋', 'c': '𝚌', 'd': '𝚍',
            'e': '𝚎', 'f': '𝚏', 'g': '𝚐', 'h': '𝚑', 'i': '𝚒',
            'j': '𝚓', 'k': '𝚔', 'l': '𝚕', 'm': '𝚖', 'n': '𝚗',
            'o': '𝚘', 'p': '𝚙', 'q': '𝚚', 'r': '𝚛', 's': '𝚜',
            't': '𝚝', 'u': '𝚞', 'v': '𝚟', 'w': '𝚠', 'x': '𝚡',
            'y': '𝚢', 'z': '𝚣'
        };
        return nom.split('').map(c => monoChars[c] || c).join('');
    },

    // Style 14: Ǹ̷ǫ̷m̷
    'weird': (nom) => {
        const weirdChars = {
            'a': 'ǟ', 'b': 'ɮ', 'c': 'ƈ', 'd': 'ɖ', 'e': 'ɛ',
            'f': 'ʄ', 'g': 'ɢ', 'h': 'ɦ', 'i': 'ɨ', 'j': 'ʝ',
            'k': 'ӄ', 'l': 'ʟ', 'm': 'ʍ', 'n': 'ɲ', 'o': 'ǫ',
            'p': 'ք', 'q': 'զ', 'r': 'ʀ', 's': 'ֆ', 't': 'ȶ',
            'u': 'ʊ', 'v': 'ʋ', 'w': 'ա', 'x': 'Ӽ', 'y': 'ʏ',
            'z': 'ʐ'
        };
        const result = nom.split('').map(c => {
            const lower = c.toLowerCase();
            return weirdChars[lower] || c;
        }).join('̷');
        return result + '̷';
    },

    // Style 15: N̳o̳m̳
    'underline2': (nom) => {
        return nom.split('').join('̳') + '̳';
    },

    // Style 16: N̷o̷m̷
    'slash': (nom) => {
        return nom.split('').join('̷') + '̷';
    },

    // Style 17: 🅝🅞🅜
    'squared': (nom) => {
        const squaredChars = {
            'a': '🅐', 'b': '🅑', 'c': '🅒', 'd': '🅓', 'e': '🅔',
            'f': '🅕', 'g': '🅖', 'h': '🅗', 'i': '🅘', 'j': '🅙',
            'k': '🅚', 'l': '🅛', 'm': '🅜', 'n': '🅝', 'o': '🅞',
            'p': '🅟', 'q': '🅠', 'r': '🅡', 's': '🅢', 't': '🅣',
            'u': '🅤', 'v': '🅥', 'w': '🅦', 'x': '🅧', 'y': '🅨',
            'z': '🅩'
        };
        return nom.toLowerCase().split('').map(c => squaredChars[c] || c).join('');
    },

    // Style 18: 𝕹𝖔𝖒 (avec 𝖔 spécial)
    'special': (nom) => {
        const specialChars = {
            'A': '𝕬', 'B': '𝕭', 'C': '𝕮', 'D': '𝕯', 'E': '𝕰',
            'F': '𝕱', 'G': '𝕲', 'H': '𝕳', 'I': '𝕴', 'J': '𝕵',
            'K': '𝕶', 'L': '𝕷', 'M': '𝕸', 'N': '𝕹', 'O': '𝕺',
            'P': '𝕻', 'Q': '𝕼', 'R': '𝕽', 'S': '𝕾', 'T': '𝕿',
            'U': '𝖀', 'V': '𝖁', 'W': '𝖂', 'X': '𝖃', 'Y': '𝖄',
            'Z': '𝖅', 'a': '𝖆', 'b': '𝖇', 'c': '𝖈', 'd': '𝖉',
            'e': '𝖊', 'f': '𝖋', 'g': '𝖌', 'h': '𝖍', 'i': '𝖎',
            'j': '𝖏', 'k': '𝖐', 'l': '𝖑', 'm': '𝖒', 'n': '𝖓',
            'o': '𝖔', 'p': '𝖕', 'q': '𝖖', 'r': '𝖗', 's': '𝖘',
            't': '𝖙', 'u': '𝖚', 'v': '𝖛', 'w': '𝖜', 'x': '𝖝',
            'y': '𝖞', 'z': '𝖟'
        };
        return nom.split('').map(c => specialChars[c] || c).join('');
    },

    // Style 19: ≋N̷o̷m̷≋
    'wave': (nom) => {
        const slashed = nom.split('').join('̷') + '̷';
        return `≋${slashed}≋`;
    },

    // Style 20: ⋆｡°✩Nom✩°｡⋆
    'star': (nom) => {
        return `⋆｡°✩${nom}✩°｡⋆`;
    }
};

// =============================================
// 2. LISTE DES STYLES DISPONIBLES
// =============================================
const STYLE_NAMES = {
    'cyber': '➻𒍜➻ Nom ▒̿ =ε/̵͇̿̿̿̿ ̿ ̿ ̿ ̿ ̿',
    'elegant': '꧁༺ Nom ༻꧂',
    'box': '╚═══╗ Nom ╔═══╝',
    'fire': '🔥 Nom 🔥',
    'wide': '【Ｎｏｍ】',
    'cursive': '𝓝𝓸𝓶',
    'double': '𝕹𝖔𝖒',
    'strike': 'N̸o̸m̸',
    'strike2': 'N̶o̶m̶',
    'underline': 'N̲o̲m̲',
    'dot': 'Ṅȯṁ',
    'bold': '𝐍𝐨𝐦',
    'mono': '𝙽𝚘𝚖',
    'weird': 'Ǹ̷ǫ̷m̷',
    'underline2': 'N̳o̳m̳',
    'slash': 'N̷o̷m̷',
    'squared': '🅝🅞🅜',
    'special': '𝕹𝖔𝖒',
    'wave': '≋N̷o̷m̷≋',
    'star': '⋆｡°✩ Nom ✩°｡⋆'
};

// =============================================
// 3. FONCTION PRINCIPALE
// =============================================
async function handlePseudo(socket, msg, sender, args, fakevCard) {
    try {
        // ✅ Réaction
        await socket.sendMessage(sender, { react: { text: '✍️', key: msg.key } }).catch(() => {});

        // Si pas de nom, afficher l'aide
        if (!args || args.length === 0) {
            let help = '✍️ *GÉNÉRATEUR DE PSEUDOS STYLÉS*\n\n';
            help += '📌 *Utilisation :*\n';
            help += '.pseudo [style] [nom]\n\n';
            help += '📝 *Styles disponibles :*\n';
            
            for (const [key, value] of Object.entries(STYLE_NAMES)) {
                help += `• ${key} : ${value}\n`;
            }
            
            help += '\n✅ *Exemples :*\n';
            help += '.pseudo cyber Diwate\n';
            help += '.pseudo elegant Diwate\n';
            help += '.pseudo fire Diwate\n';
            help += '.pseudo all Diwate (affiche tous les styles)\n';
            
            await socket.sendMessage(sender, { text: help }, { quoted: fakevCard || msg });
            return true;
        }

        // Vérifier si c'est un style ou un nom
        let style = args[0].toLowerCase();
        let nom = args.slice(1).join(' ');

        // Si "all", afficher tous les styles
        if (style === 'all') {
            if (!nom) {
                await socket.sendMessage(sender, {
                    text: '❌ *Donne un nom à styliser !*\n\nExemple : .pseudo all Diwate'
                }, { quoted: fakevCard || msg });
                return true;
            }

            let message = `✍️ *TOUS LES STYLES POUR ${nom.toUpperCase()}*\n\n`;
            for (const [key, fn] of Object.entries(STYLES)) {
                try {
                    const result = fn(nom);
                    message += `*${key} :*\n${result}\n\n`;
                } catch (e) {
                    message += `*${key} :* ❌ Erreur\n\n`;
                }
            }
            message += `📌 *Choisis un style :* .pseudo [style] ${nom}`;
            
            await socket.sendMessage(sender, { text: message }, { quoted: fakevCard || msg });
            return true;
        }

        // Si pas de nom, utiliser le nom de l'utilisateur
        if (!nom) {
            nom = msg.pushName || sender.split('@')[0];
        }

        // Vérifier si le style existe
        if (!STYLES[style]) {
            let availableStyles = Object.keys(STYLES).join(', ');
            await socket.sendMessage(sender, {
                text: `❌ *Style inconnu :* "${style}"\n\n📝 *Styles disponibles :*\n${availableStyles}`
            }, { quoted: fakevCard || msg });
            return true;
        }

        // Générer le pseudo
        const result = STYLES[style](nom);

        // Envoyer le résultat
        await socket.sendMessage(sender, {
            text: `✍️ *PSEUDO STYLÉ*\n\n` +
                  `📝 *Style :* ${style}\n` +
                  `👤 *Nom :* ${nom}\n\n` +
                  `✨ *Résultat :*\n${result}\n\n` +
                  `📋 *Copie :* \`${result}\``
        }, { quoted: fakevCard || msg });

        return true;

    } catch (error) {
        console.error('Erreur handlePseudo:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur :*\n${error.message}`
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }
}

module.exports = { handlePseudo };
