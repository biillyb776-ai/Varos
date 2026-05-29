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
        this.bot = mineflayer.createBot({ 
            ...this.options, 
            hideErrors: true, 
            checkTimeoutInterval: 120000 
        });
        this.bot.loadPlugin(pathfinder);
        this.setupEvents();
    }

    // --- HATA GEÇİRMEZ HAREKET MOTORU ---
    // Baritone/Pathfinder çalışırken bot koparsa kodun çökmesini engeller
    safeControl(action, state) {
        if (this.bot && this.bot.setControlState) {
            try {
                this.bot.setControlState(action, state);
            } catch (e) { /* Hata yutuldu, sistem devam eder */ }
        }
    }

    setupEvents() {
        this.bot.on("spawn", async () => {
            console.log(color.green(`[BOT] Giriş yaptı. Baritone/Pathfinder aktif.`));
            setTimeout(() => this.bot.chat(`/login ${this.options.password}`), 3000);
            this.startPortalRoutine();
        });
        
        this.bot.on("end", () => {
            console.log(color.yellow(`[SİSTEM] Bağlantı koptu, 10s sonra yeniden deneniyor...`));
            setTimeout(() => this.init(), 10000);
        });
    }

    startPortalRoutine() {
        // Portal arama döngüsü
        const routine = setInterval(() => {
            if (!this.bot || !this.bot.entity || this.isExecuting) return;

            const portal = this.bot.findBlock({
                matching: (b) => b.name === 'nether_portal' || b.name === 'portal',
                maxDistance: 32
            });

            if (portal) {
                const dist = this.bot.entity.position.distanceTo(portal.position);
                this.bot.lookAt(portal.position.offset(0, 1, 0));

                if (dist < 1.3) {
                    // PORTALA VARINCA TİTREŞİMLİ GİRİŞİ BAŞLAT
                    this.perform6b6tEntry();
                } else {
                    // BARITONE YOL BULMA İLE İLERLE
                    this.safeControl("forward", true);
                    this.safeControl("sprint", true);
                }
            }
        }, 500);
    }

    // 6b6t BOTLARININ O MEŞHUR GİRİŞ DAVRANIŞI
    perform6b6tEntry() {
        if (this.isExecuting) return;
        this.isExecuting = true;
        
        console.log(color.magenta(`[6b6t] Portal girişi tetiklendi (Titreşim modu)...`));
        
        let count = 0;
        const interval = setInterval(() => {
            // İleri ve geri tuşlarına kısa aralıklarla basarak "tık tık" etkisi yarat
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
