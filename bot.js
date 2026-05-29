const mineflayer = require("mineflayer");
const pathfinder = require('@miner-org/mineflayer-baritone').loader;
const color = require("colors");

class PlayerBot {
    constructor(options) {
        this.options = options;
        this.init();
    }

    init() {
        // Hata korumalı bot oluşturma
        this.bot = mineflayer.createBot({ ...this.options, hideErrors: true });
        this.bot.loadPlugin(pathfinder);
        this.setupEvents();
    }

    setupEvents() {
        this.bot.on("spawn", async () => {
            console.log(color.green(`[BOT] Giriş yaptı.`));
            setTimeout(() => this.bot.chat(`/login ${this.options.password}`), 3000);
            this.startPortalRoutine();
        });
        
        // Hata durumunda yeniden bağlanma
        this.bot.on("end", () => setTimeout(() => this.init(), 10000));
    }

    startPortalRoutine() {
        // Güvenli bir şekilde döngü başlat
        this.routine = setInterval(() => {
            // BOTUN VARLIĞINI KONTROL ET
            if (!this.bot || !this.bot.findBlock) return;

            const portal = this.bot.findBlock({
                matching: (b) => b.name === 'nether_portal' || b.name === 'portal',
                maxDistance: 32
            });

            if (portal) {
                const dist = this.bot.entity ? this.bot.entity.position.distanceTo(portal.position) : 999;
                
                this.bot.lookAt(portal.position.offset(0, 1, 0));

                if (dist < 1.3) {
                    this.performVideoAction();
                } else {
                    // Güvenli hareket
                    if (this.bot.setControlState) {
                        this.bot.setControlState("forward", true);
                        this.bot.setControlState("sprint", true);
                    }
                }
            }
        }, 500);
    }

    performVideoAction() {
        // Hareketleri tek bir güvenli fonksiyonda topla
        const move = (action, state) => {
            if (this.bot && this.bot.setControlState) {
                this.bot.setControlState(action, state);
            }
        };

        move("forward", true);
        setTimeout(() => move("forward", false), 200);
        setTimeout(() => move("back", true), 200);
        setTimeout(() => move("back", false), 400);
    }
}

module.exports = (options) => new PlayerBot(options);
