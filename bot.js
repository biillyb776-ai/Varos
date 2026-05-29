const mineflayer = require("mineflayer");
const pathfinder = require('@miner-org/mineflayer-baritone').loader;
const color = require("colors");

class AdvancedBot {
    constructor(options) {
        this.options = options;
        this.init();
    }

    init() {
        this.bot = mineflayer.createBot({ ...this.options, hideErrors: true });
        this.bot.loadPlugin(pathfinder);
        this.setupEvents();
    }

    setupEvents() {
        this.bot.on("spawn", async () => {
            console.log(color.green(`[SİSTEM] Bot lobiye girdi.`));
            setTimeout(() => this.bot.chat(`/login ${this.options.password}`), 3000);
            this.startRadar();
        });
        this.bot.on("end", () => setTimeout(() => this.init(), 5000));
    }

    // GÜVENLİ HAREKET FONKSİYONU
    setMove(action, state) {
        if (this.bot && this.bot.setControlState) {
            try {
                this.bot.setControlState(action, state);
            } catch (e) {}
        }
    }

    startRadar() {
        setInterval(() => {
            // BOTUN VARLIĞINI KONTROL ET
            if (!this.bot || !this.bot.entity) return;
            
            const portal = this.bot.findBlock({
                matching: (b) => b.name === 'nether_portal' || b.name === 'portal',
                maxDistance: 32
            });

            if (portal) {
                const dist = this.bot.entity.position.distanceTo(portal.position);
                process.stdout.write(color.cyan(`\r[RADAR] Uzaklık: ${dist.toFixed(1)}m`));
                
                this.bot.lookAt(portal.position.offset(0, 1, 0));
                this.setMove("forward", true);
            }
        }, 1000);
    }
}

module.exports = (options) => new AdvancedBot(options);
