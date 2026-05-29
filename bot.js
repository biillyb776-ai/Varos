const mineflayer = require("mineflayer");
const color = require("colors");

class ProBot {
    constructor(options) {
        this.options = options;
        this.isExecuting = false; 
        this.portalTimer = null;  
        this.init();
    }

    init() {
        const botSettings = {
            ...this.options,
            auth: 'offline', // 6b6t için zorunlu crack modu
            hideErrors: true
        };

        this.bot = mineflayer.createBot(botSettings);

        // --- BARITONE HATA ENGELLEYİCİ GÜVENLİ YÜKLEME ---
        try {
            const baritoneModule = require('@miner-org/mineflayer-baritone');
            // Modülün fonksiyon olan kısmını çekiyoruz (Hatayı kesin çözer)
            const baritonePlugin = baritoneModule.baritone || baritoneModule.default || baritoneModule;
            
            if (typeof baritonePlugin === 'function') {
                this.bot.loadPlugin(baritonePlugin);
                console.log(color.cyan(`[SİSTEM] Baritone başarıyla yüklendi! (bot.baritone aktif)`));
            } else {
                console.log(color.yellow(`[UYARI] Baritone fonksiyonu ayıklanamadı, düz modda devam ediliyor.`));
            }
        } catch (err) {
            console.log(color.red(`[HATA] Baritone yüklenirken sistemsel hata: ${err.message}`));
        }

        this.setupEvents();
    }

    // --- HATA GEÇİRMEZ HAREKET SİSTEMİ ---
    safeControl(action, state) {
        if (this.bot && this.bot.controlState) {
            try {
                this.bot.setControlState(action, state);
            } catch (e) { /* Hataları yut */ }
        }
    }

    // Tüm tuşları serbest bırakır
    clearMovement() {
        const actions = ["forward", "back", "left", "right", "jump", "sprint"];
        actions.forEach(action => this.safeControl(action, false));
    }

    setupEvents() {
        this.bot.on("spawn", async () => {
            console.log(color.green(`[6b6t] ${this.bot.username} sunucuya başarıyla giriş yaptı.`));
            
            if (this.portalTimer) clearInterval(this.portalTimer);
            this.isExecuting = false;

            // Otomatik giriş komutu
            setTimeout(() => {
                if (this.bot && this.bot.chat) {
                    this.bot.chat(`/login ${this.options.password}`);
                }
            }, 3000);

            // Orijinal repo portal takibini başlat
            this.startPortalBehavior();
        });

        this.bot.on("end", () => {
            if (this.portalTimer) clearInterval(this.portalTimer);
            const delay = this.options.reconnectDelay || 5000;
            console.log(color.red(`[DURUM] Bağlantı kesildi. ${delay / 1000} saniye sonra yeniden denenecek...`));
            setTimeout(() => this.init(), delay);
        });
    }

    startPortalBehavior() {
        // Her 400 milisaniyede bir çevreyi radarla tara
        this.portalTimer = setInterval(() => {
            if (!this.bot || !this.bot.entity || this.isExecuting) return;

            // En yakın nether portal bloğunu bul
            const portal = this.bot.findBlock({
                matching: (b) => b && (b.name === 'nether_portal' || b.name === 'portal'),
                maxDistance: 32
            });

            if (portal) {
                const dist = this.bot.entity.position.distanceTo(portal.position);
                
                // Kafayı portala odakla
                this.bot.lookAt(portal.position.offset(0, 1, 0));

                // Portala girdik mi?
                if (dist <= 1.4) {
                    this.clearMovement(); // Düz yürümeyi kapat ki titreşim çalışsın
                    this.perform6b6tEntry();
                } else {
                    // Uzaktaysak portala doğru depar at
                    this.safeControl("forward", true);
                    this.safeControl("sprint", true);
                }
            } else {
                this.clearMovement();
            }
        }, 400);
    }

    // 6B6T ANTİ-CHEAT BYPASS MANTIĞI (W-S TİTREŞİMİ)
    perform6b6tEntry() {
        this.isExecuting = true;
        console.log(color.magenta(`[PORTAL] Portala girildi! Titreşim bypass modu devrede.`));
        
        let count = 0;
        const interval = setInterval(() => {
            if (!this.bot) {
                clearInterval(interval);
                return;
            }

            // İleri-geri glitch hareketi
            this.safeControl("forward", count % 2 === 0);
            this.safeControl("back", count % 2 !== 0);
            
            count++;
            
            if (count > 20) {
                clearInterval(interval);
                this.clearMovement(); 
                console.log(color.bgGreen.black(`[BAŞARI] Titreşim tamamlandı. Aktarım bekleniyor...`));
                
                // Yeniden tetiklenmemesi için 15 saniye kilitle
                setTimeout(() => {
                    this.isExecuting = false;
                }, 15000);
            }
        }, 200);
    }
}

module.exports = (options) => new ProBot(options);
