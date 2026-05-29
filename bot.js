const mineflayer = require("mineflayer");
const pathfinder = require('@miner-org/mineflayer-baritone').loader;
const color = require("colors");

class PlayerBot {
    constructor(options) {
        this.options = options;
        this.init();
    }

    init() {
        this.bot = mineflayer.createBot({ 
            ...this.options, 
            hideErrors: true,
            checkTimeoutInterval: 120000 
        });
        this.bot.loadPlugin(pathfinder);
        this.setupEvents();
    }

    setupEvents() {
        this.bot.on("spawn", async () => {
            console.log(color.green(`[BOT] Dünyaya giriş yaptı.`));
            setTimeout(() => this.bot.chat(`/login ${this.options.password}`), 3000);
            this.startPortalRoutine();
        });
        this.bot.on("end", () => setTimeout(() => this.init(), 10000));
    }

    startPortalRoutine() {
        setInterval(() => {
            if (!this.bot || !this.bot.entity) return;

            const portal = this.bot.findBlock({
                matching: (b) => b.name === 'nether_portal' || b.name === 'portal',
                maxDistance: 32
            });

            if (portal) {
                const dist = this.bot.entity.position.distanceTo(portal.position);
                
                // 1. Videodaki gibi portala bak
                this.bot.lookAt(portal.position.offset(0, 1, 0));

                // 2. Eğer portal çok yakınsa (videodaki yarım giriş), titreşim başlat
                if (dist < 1.3) {
                    this.performVideoAction();
                } else {
                    // 3. Uzaktaysa düz yürü
                    this.bot.setControlState("forward", true);
                    this.bot.setControlState("sprint", true);
                }
            }
        }, 500);
    }

    // VİDEODAKİ O KÜÇÜK İLERİ-GERİ HAREKETLERİ
    performVideoAction() {
        const actions = ["forward", "back"];
        let i = 0;
        setInterval(() => {
            this.bot.setControlState(actions[i % 2], true);
            setTimeout(() => this.bot.setControlState(actions[i % 2], false), 200);
            i++;
        }, 400);
    }
}

module.exports = (options) => new PlayerBot(options);
