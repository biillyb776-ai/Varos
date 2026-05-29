const mineflayer = require("mineflayer");
const pathfinder = require('@miner-org/mineflayer-baritone').loader;
const color = require("colors");

class ProBot {
    constructor(options) {
        this.options = options;
        this.isExecuting = false;
        this.init();
    }

    init() {
        this.bot = mineflayer.createBot({ ...this.options, hideErrors: true });
        this.bot.loadPlugin(pathfinder);
        this.setupEvents();
    }

    // --- HATA GEÇİRMEZ HAREKET MOTORU ---
    safeControl(action, state) {
        // controlState nesnesi var mı diye kontrol et, yoksa hata verme
        if (this.bot && this.bot.controlState) {
            try {
                this.bot.setControlState(action, state);
            } catch (e) { /* Hata yutuldu */ }
        }
    }

    setupEvents() {
        this.bot.on("spawn", async () => {
            console.log(color.green(`[BOT] 6b6t Lobiye giriş yaptı.`));
            setTimeout(() => this.bot.chat(`/login ${this.options.password}`), 3000);
            this.startPortalBehavior();
        });
        this.bot.on("end", () => setTimeout(() => this.init(), 5000));
    }

    startPortalBehavior() {
        setInterval(() => {
            if (!this.bot || !this.bot.entity || this.isExecuting) return;

            const portal = this.bot.findBlock({
                matching: (b) => b.name === 'nether_portal' || b.name === 'portal',
                maxDistance: 32
            });

            if (portal) {
                const dist = this.bot.entity.position.distanceTo(portal.position);
                this.bot.lookAt(portal.position.offset(0, 1, 0));

                if (dist < 1.3) {
                    this.perform6b6tEntry();
                } else {
                    this.safeControl("forward", true);
                    this.safeControl("sprint", true);
                }
            }
        }, 500);
    }

    // 6b6t BOTLARININ O MEŞHUR "TİTREŞİMLİ" GİRİŞİ
    perform6b6tEntry() {
        this.isExecuting = true;
        console.log(color.magenta(`[6b6t] Portal girişi tetiklendi...`));
        
        let count = 0;
        const interval = setInterval(() => {
            // İleri ve geri tuşlarına kısa aralıklarla basarak "titreşim" yarat
            this.safeControl("forward", count % 2 === 0);
            this.safeControl("back", count % 2 !== 0);
            
            count++;
            if (count > 15) {
                clearInterval(interval);
                this.isExecuting = false;
                console.log(color.bgGreen.black(`!! BAŞARILI: PORTALDA AKTARIM BEKLENİYOR !!`));
            }
        }, 200);
    }
}

module.exports = (options) => new ProBot(options);
z
