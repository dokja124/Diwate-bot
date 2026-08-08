/**
 * citation.js — Commande .citation : envoie une citation aléatoire d'un
 * personnage de manga/anime.
 * ---------------------------------------------------------------
 * Version ✨ DELUXE ✨ avec emojis pour chaque citation !
 * 
 * Comment l'intégrer dans pair.js :
 * ----------------------------------
 * 1. En haut de pair.js, ajoute :
 *      const { handleCitation } = require('./citation');
 *
 * 2. Dans le switch(command), ajoute :
 *      case 'citation': {
 *          await handleCitation(socket, msg, sender, fakevCard);
 *          break;
 *      }
 */

const CITATIONS = [
    // 🔥 DEMON SLAYER
    { texte: "💥 Aucun cœur ne peut être brisé par un chagrin que l'on n'a jamais ressenti.", personnage: "🦊 Tanjirō Kamado", oeuvre: "🔥 Demon Slayer" },
    { texte: "🔥 Les battements de mon cœur ne mentent jamais. Ma colère est la preuve que je suis humain.", personnage: "⚔️ Kyojuro Rengoku", oeuvre: "🔥 Demon Slayer" },
    { texte: "🌀 Ceux qui vivent sans connaître la peur sont plus faibles que ceux qui la surmontent.", personnage: "🌊 Giyū Tomioka", oeuvre: "🔥 Demon Slayer" },
    { texte: "🌸 Même si tu es brisé, tant que tu as la volonté de te battre, tu peux te relever.", personnage: "🎀 Nezuko Kamado", oeuvre: "🔥 Demon Slayer" },
    { texte: "☀️ La flamme de la vie doit brûler de tout son éclat avant de s'éteindre.", personnage: "⚔️ Kyojuro Rengoku", oeuvre: "🔥 Demon Slayer" },

    // ⚡ JUJUTSU KAISEN
    { texte: "👁️ Meurs avec un sourire. C'est le devoir de ceux qui sont forts envers les faibles.", personnage: "🌀 Satoru Gojo", oeuvre: "⚡ Jujutsu Kaisen" },
    { texte: "😈 Le désespoir est la seule chose qu'on ne peut pas maîtriser.", personnage: "👹 Ryomen Sukuna", oeuvre: "⚡ Jujutsu Kaisen" },
    { texte: "💪 Au lieu de te plaindre de ta faiblesse, trouve comment devenir plus fort.", personnage: "🧑‍🎤 Yuji Itadori", oeuvre: "⚡ Jujutsu Kaisen" },
    { texte: "🌑 Les regrets sont comme des cicatrices. Ils guérissent mais restent à vie.", personnage: "🐺 Megumi Fushiguro", oeuvre: "⚡ Jujutsu Kaisen" },
    { texte: "💼 La force sans conviction est juste une forme de faiblesse.", personnage: "👔 Kento Nanami", oeuvre: "⚡ Jujutsu Kaisen" },

    // 🔪 CHAINSAW MAN
    { texte: "⛓️ Une vie normale est plus effrayante que n'importe quel démon.", personnage: "⚡ Denji", oeuvre: "🔪 Chainsaw Man" },
    { texte: "💔 Les rêves ne sont que des souvenirs que l'on n'a pas encore vécus.", personnage: "👁️‍🗨️ Makima", oeuvre: "🔪 Chainsaw Man" },
    { texte: "❤️‍🔥 L'amour et la haine sont deux faces d'une même pièce.", personnage: "🚬 Aki Hayakawa", oeuvre: "🔪 Chainsaw Man" },
    { texte: "🍞 Pour avoir un rêve, il faut d'abord survivre.", personnage: "⚡ Denji", oeuvre: "🔪 Chainsaw Man" },

    // 🏴‍☠️ ONE PIECE
    { texte: "💀 Les rêves d'un homme ne meurent jamais !", personnage: "🏴‍☠️ Edward Newgate (Barbe Blanche)", oeuvre: "⛵ One Piece" },
    { texte: "⚕️ On ne demande pas à un homme de se battre. On lui donne une raison de le faire.", personnage: "🩺 Trafalgar Law", oeuvre: "⛵ One Piece" },
    { texte: "🌊 Le véritable pouvoir, c'est de protéger ce qui est important.", personnage: "🦈 Jinbe", oeuvre: "⛵ One Piece" },
    { texte: "🌅 Un homme doit toujours tourner son regard vers l'horizon.", personnage: "🍺 Shanks", oeuvre: "⛵ One Piece" },
    { texte: "👊 Ce n'est pas la mort qui définit un homme, mais comment il a vécu.", personnage: "👴 Monkey D. Garp", oeuvre: "⛵ One Piece" },
    { texte: "😤 Je vais devenir le seigneur des pirates !", personnage: "🍖 Monkey D. Luffy", oeuvre: "⛵ One Piece" },
    { texte: "🌸 Tant que les gens continueront de célébrer les héros, il y aura des méchants.", personnage: "🌺 Nico Robin", oeuvre: "⛵ One Piece" },
    { texte: "🔥 Ce n'est pas parce qu'on rêve qu'on est faible.", personnage: "🧢 Sabo", oeuvre: "⛵ One Piece" },
    { texte: "👊 Je suis venu ici pour dépasser Kaido, pas pour perdre !", personnage: "🍖 Monkey D. Luffy", oeuvre: "⛵ One Piece" },
    { texte: "⚔️ Ce n'est pas la taille des rêves qui compte, c'est le fait de ne jamais les abandonner.", personnage: "🗡️ Roronoa Zoro", oeuvre: "⛵ One Piece" },
    { texte: "⚔️ Si je meurs en essayant d'atteindre mon objectif, c'est très bien. Au moins j'aurais essayé.", personnage: "🗡️ Roronoa Zoro", oeuvre: "⛵ One Piece" },
    { texte: "👊 Si tu ne prends pas de risques, tu ne peux pas créer un futur.", personnage: "🍖 Monkey D. Luffy", oeuvre: "⛵ One Piece" },

    // 🍥 NARUTO
    { texte: "🤝 Les liens entre nous sont ce qui nous rend vraiment forts.", personnage: "🦊 Naruto Uzumaki", oeuvre: "🍥 Naruto" },
    { texte: "👑 Le pouvoir d'un Kage est de protéger son village, pas de le dominer.", personnage: "🌿 Hashirama Senju", oeuvre: "🍥 Naruto" },
    { texte: "💧 La haine est un cycle qui ne produit que des larmes.", personnage: "🌀 Nagato (Pain)", oeuvre: "🍥 Naruto" },
    { texte: "👁️ Un homme qui ne prend pas soin de son passé ne mérite pas de futur.", personnage: "🪶 Itachi Uchiha", oeuvre: "🍥 Naruto" },
    { texte: "🐸 La douleur te permet de grandir plus fort.", personnage: "🗿 Jiraiya", oeuvre: "🍥 Naruto" },
    { texte: "🍥 Je vais devenir le prochain Hokage !", personnage: "🦊 Naruto Uzumaki", oeuvre: "🍥 Naruto" },
    { texte: "📖 Ceux qui brisent les règles sont des ordures, mais ceux qui abandonnent leurs amis sont pires que des ordures.", personnage: "🐶 Kakashi Hatake", oeuvre: "🍥 Naruto" },
    { texte: "🌙 La solitude est plus douloureuse que la douleur elle-même.", personnage: "🌀 Nagato", oeuvre: "🍥 Naruto" },
    { texte: "🦅 Ceux qui pardonnent aux autres sont vraiment forts.", personnage: "⚡ Sasuke Uchiha", oeuvre: "🍥 Naruto" },

    // 🦸 MY HERO ACADEMIA
    { texte: "💪 Un héros n'est pas défini par son pouvoir, mais par son cœur.", personnage: "🇺🇸 All Might", oeuvre: "🦸 My Hero Academia" },
    { texte: "🛡️ Les vrais héros sauvent même leurs ennemis.", personnage: "💚 Izuku Midoriya", oeuvre: "🦸 My Hero Academia" },
    { texte: "🌸 Avancer malgré la peur, c'est ça le vrai courage.", personnage: "🪐 Ochaco Uraraka", oeuvre: "🦸 My Hero Academia" },
    { texte: "📝 Un jour, quand tu regarderas en arrière, ces jours difficiles t'auront rendu plus fort.", personnage: "💚 Izuku Midoriya", oeuvre: "🦸 My Hero Academia" },
    { texte: "💪 Il n'est pas nécessaire d'être parfait pour être un héros.", personnage: "🇺🇸 All Might", oeuvre: "🦸 My Hero Academia" },
    { texte: "🔥 Plus Ultra !", personnage: "🇺🇸 All Might", oeuvre: "🦸 My Hero Academia" },
    { texte: "💚 Je ne cours plus après les rêves des autres. Je poursuis les miens.", personnage: "🦸 Deku", oeuvre: "🦸 My Hero Academia" },

    // 📓 DEATH NOTE
    { texte: "🍎 Les humains sont vraiment fascinants... et terrifiants.", personnage: "👤 L", oeuvre: "📓 Death Note" },
    { texte: "✍️ Un monde parfait n'existe que dans les rêves des idéalistes.", personnage: "📓 Light Yagami", oeuvre: "📓 Death Note" },
    { texte: "⚖️ La justice ne peut exister sans un équilibre entre lumière et ténèbres.", personnage: "🎯 Near", oeuvre: "📓 Death Note" },

    // 🔥 FIRE FORCE
    { texte: "🔥 La peur n'est pas une faiblesse. C'est un instinct qui nous protège.", personnage: "👟 Shinra Kusakabe", oeuvre: "🔥 Fire Force" },
    { texte: "⚔️ Brûle plus fort que tes cauchemars.", personnage: "🗡️ Arthur Boyle", oeuvre: "🔥 Fire Force" },

    // 🎩 BLACK BUTLER
    { texte: "🖤 La vengeance ne guérit pas, elle ne fait qu'apaiser l'esprit.", personnage: "🍷 Sebastian Michaelis", oeuvre: "🎩 Black Butler" },
    { texte: "👁️ La loyauté est la plus belle des vertus.", personnage: "🔮 Ciel Phantomhive", oeuvre: "🎩 Black Butler" },

    // 🌙 SAILOR MOON
    { texte: "💖 L'amour et la justice triomphent toujours.", personnage: "🌙 Sailor Moon", oeuvre: "🌙 Sailor Moon" },
    { texte: "⭐ Le pouvoir de l'amitié est plus fort que n'importe quelle magie.", personnage: "💛 Sailor Venus", oeuvre: "🌙 Sailor Moon" },

    // 🔮 FULLMETAL ALCHEMIST
    { texte: "⚖️ Rien ne s'obtient sans sacrifice. C'est la loi de l'équivalence.", personnage: "🧑‍🔬 Edward Elric", oeuvre: "🔮 Fullmetal Alchemist" },
    { texte: "🔄 La vie est une série d'échanges. On perd pour gagner.", personnage: "🗡️ Alphonse Elric", oeuvre: "🔮 Fullmetal Alchemist" },
    { texte: "🔥 Ce qui est impossible... c'est juste quelque chose qu'on n'a pas encore fait.", personnage: "🧤 Roy Mustang", oeuvre: "🔮 Fullmetal Alchemist" },
    { texte: "📚 L'échec n'est qu'une autre façon d'apprendre comment faire quelque chose de bien.", personnage: "🧑‍🔬 Edward Elric", oeuvre: "🔮 Fullmetal Alchemist" },

    // ⚔️ VINLAND SAGA
    { texte: "🛡️ Un lâche reste faible. Un vrai homme affronte ses peurs.", personnage: "🗡️ Thorfinn", oeuvre: "⚔️ Vinland Saga" },
    { texte: "🍺 La vengeance est un poison qui ronge celui qui le boit.", personnage: "🏹 Askellad", oeuvre: "⚔️ Vinland Saga" },

    // 🎸 BOCCHI THE ROCK
    { texte: "🎸 Le talent, ça se travaille. La passion, elle est innée.", personnage: "🎀 Hitori Goto", oeuvre: "🎸 Bocchi the Rock!" },

    // 🏀 SLAM DUNK
    { texte: "🏀 Quand tu renonces, la partie est déjà perdue.", personnage: "🦁 Hanamichi Sakuragi", oeuvre: "🏀 Slam Dunk" },
    { texte: "🔄 Un rebond, c'est une seconde chance de réussir.", personnage: "🦅 Kaede Rukawa", oeuvre: "🏀 Slam Dunk" },

    // 🥷 NINJA SCROLL
    { texte: "🥷 Un ninja n'a pas de maître. Il suit sa propre voie.", personnage: "⚔️ Jubei Kibagami", oeuvre: "🥷 Ninja Scroll" },

    // 🕵️ SPY × FAMILY
    { texte: "😊 Un sourire peut désarmer n'importe quel ennemi.", personnage: "🌸 Anya Forger", oeuvre: "🕵️ Spy × Family" },
    { texte: "💼 La famille, c'est ceux pour qui on est prêt à tout.", personnage: "🕵️ Loid Forger", oeuvre: "🕵️ Spy × Family" },

    // 💪 ONE PUNCH MAN
    { texte: "🦸 Un vrai héros n'a pas besoin de reconnaissance.", personnage: "🦲 Saitama", oeuvre: "💪 One Punch Man" },
    { texte: "🔥 La force est un fardeau. Le vrai défi, c'est de savoir la contrôler.", personnage: "🤖 Genos", oeuvre: "💪 One Punch Man" },

    // 🏫 GREAT TEACHER ONIZUKA
    { texte: "📚 Les notes ne font pas un homme. C'est son cœur qui compte.", personnage: "🏍️ Eikichi Onizuka", oeuvre: "🏫 Great Teacher Onizuka" },

    // ⚔️ RUROUNI KENSHIN
    { texte: "🗡️ Un sabre ne tue pas. C'est l'homme qui le porte qui décide.", personnage: "🌸 Kenshin Himura", oeuvre: "⚔️ Rurouni Kenshin" },

    // 🌌 COWBOY BEBOP
    { texte: "🚀 Le passé est comme un vaisseau qui s'éloigne. Il ne revient jamais.", personnage: "🐺 Spike Spiegel", oeuvre: "🌌 Cowboy Bebop" },
    { texte: "🛸 Parfois, la seule chose qu'on peut faire, c'est se souvenir.", personnage: "⚙️ Jet Black", oeuvre: "🌌 Cowboy Bebop" },

    // 🎲 KAIJI
    { texte: "🃏 La vie est un pari. Celui qui ne risque rien n'a rien.", personnage: "😤 Kaiji Itō", oeuvre: "🎲 Kaiji" },

    // 🎯 HUNTER × HUNTER
    { texte: "❓ Là où il y a un doute, il n'y a pas de certitude.", personnage: "⚡ Killua Zoldyck", oeuvre: "🎯 Hunter × Hunter" },
    { texte: "🔍 Un chasseur doit toujours garder sa curiosité.", personnage: "🌱 Gon Freecss", oeuvre: "🎯 Hunter × Hunter" },
    { texte: "⚖️ La véritable force ne réside pas dans le pouvoir, mais dans la volonté.", personnage: "🔗 Kurapika", oeuvre: "🎯 Hunter × Hunter" },

    // 🐉 DRAGON BALL
    { texte: "🛡️ Un vrai guerrier ne recule jamais devant le danger.", personnage: "🐉 Son Goku", oeuvre: "🐉 Dragon Ball" },
    { texte: "💪 Peu importe combien de fois je tombe, je me relèverai toujours.", personnage: "🐉 Son Goku", oeuvre: "🐉 Dragon Ball" },
    { texte: "⚡ Le pouvoir ne vient pas de la victoire. Tes luttes développent ta force.", personnage: "🐉 Son Goku", oeuvre: "🐉 Dragon Ball" },

    // 🏔️ L'ATTAQUE DES TITANS
    { texte: "🏔️ L'humanité peut être stupide, mais elle peut aussi être magnifique.", personnage: "🟢 Eren Yeager", oeuvre: "🏔️ L'Attaque des Titans" },
    { texte: "⚔️ Si tu gagnes, tu vis. Si tu perds, tu meurs. Si tu ne combats pas, tu ne peux pas gagner.", personnage: "🧼 Levi Ackerman", oeuvre: "🏔️ L'Attaque des Titans" },
    { texte: "🌸 Le monde est cruel, mais aussi très beau.", personnage: "🧣 Mikasa Ackerman", oeuvre: "🏔️ L'Attaque des Titans" },
    { texte: "📖 Ceux qui ne peuvent pas sacrifier quoi que ce soit ne peuvent jamais rien changer.", personnage: "📚 Armin Arlert", oeuvre: "🏔️ L'Attaque des Titans" },

    // 🗡️ BLEACH
    { texte: "❤️ Un cœur qui ne peut protéger n'a aucune valeur.", personnage: "🗡️ Kenpachi Zaraki", oeuvre: "🗡️ Bleach" },
    { texte: "⚔️ Se tenir sur le champ de bataille sans peur, voilà ce qu'est un vrai guerrier.", personnage: "🌊 Ichigo Kurosaki", oeuvre: "🗡️ Bleach" },
    { texte: "💀 Les hommes qui ne peuvent pas oublier leurs rêves ne grandissent jamais.", personnage: "🗡️ Zaraki Kenpachi", oeuvre: "🗡️ Bleach" },

    // 🔥 FAIRY TAIL
    { texte: "🔥 Peu importe combien de fois tu tombes, ce qui compte c'est de te relever.", personnage: "🐉 Natsu Dragneel", oeuvre: "🔥 Fairy Tail" },
    { texte: "🛡️ Un lâche qui rassemble son courage pour protéger ses amis n'est plus un lâche.", personnage: "🐉 Natsu Dragneel", oeuvre: "🔥 Fairy Tail" },

    // 👑 CODE GEASS
    { texte: "👁️ Le talent, c'est décider quoi faire avec ton temps.", personnage: "👑 Lelouch Lamperouge", oeuvre: "👑 Code Geass" },
    { texte: "💀 Vivre sans but est pire que mourir.", personnage: "👑 Lelouch Lamperouge", oeuvre: "👑 Code Geass" },

    // 🌀 GURREN LAGANN
    { texte: "👊 Je préfère mourir en héros que vivre en lâche.", personnage: "⛏️ Simon", oeuvre: "🌀 Gurren Lagann" },
    { texte: "🌀 Perce les cieux avec ta foreuse !", personnage: "🕶️ Kamina", oeuvre: "🌀 Gurren Lagann" },
    { texte: "🌟 Qui es-tu pour décider que tes rêves sont impossibles ?", personnage: "🕶️ Kamina", oeuvre: "🌀 Gurren Lagann" },

    // ⚔️ BERSERK
    { texte: "🗡️ Il n'y a pas de sens à vivre si tu n'es pas prêt à mourir pour ce en quoi tu crois.", personnage: "⚔️ Guts", oeuvre: "⚔️ Berserk" },
];

async function handleCitation(socket, msg, sender, fakevCard) {
    try {
        const choix = CITATIONS[Math.floor(Math.random() * CITATIONS.length)];

        const message = `📖 *CITATION DU JOUR* ✨\n\n` +
            `" ${choix.texte} "\n\n` +
            `— ${choix.personnage}\n` +
            `🎬 ${choix.oeuvre}`;

        await socket.sendMessage(sender, { text: message }, { quoted: fakevCard || msg });
        return true;
    } catch (error) {
        console.error('Erreur handleCitation:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur lors de la récupération de la citation.*`
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }
}

module.exports = { handleCitation, CITATIONS };
