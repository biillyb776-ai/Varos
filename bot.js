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
        // index.js içindeki bilgileri (host, username, password) aynen aktarıyoruz
        const botSettings = {
            ...this.options,
            auth: 'offline', // 6b6t gibi crack sunucular için zorunlu mod
            hideErrors: true
        };

        this.bot = mineflayer.createBot(botSettings);
        
        // package.json'daki Baritone eklentisini güvenli (çökmesiz) yükleme modu
        try {
            const rawBaritone = require('@miner-org/mineflayer-baritone');
            const baritonePlugin = rawBaritone.baritone || rawBaritone.default || rawBaritone;
            
            if (typeof baritonePlugin === 'function') {
                this.bot.loadPlugin(baritonePlugin);
            }
        } catch (err) {
            // Hata verirse terminale bas ama botun açılmasını engelleme
            console.log(color.yellow(`[SİSTEM] Baritone modülü düz modda es geçildi: ${err.message}`));
        }

        this.setupEvents();
    }

    // --- 6B6T HAREKET VE TUŞ MOTORU ---
    safeControl(action, state) {
        if (this.bot && this.bot.controlState) {
            try {
                this.bot.setControlState(action, state);
            } catch (e) { /* Hataları yut */ }
        }
    }

    // Botun yürüyüş tuşlarını tamamen serbest bırakır
    clearMovement() {
        const actions = ["forward", "back", "left", "right", "jump", "sprint"];
        actions.forEach(action => this.safeControl(action, false));
    }

    setupEvents() {
        // Bot lobiden sıraya veya ana dünyaya her geçtiğinde tetiklenir
        this.bot.on("spawn", async () => {
            console.log(color.green(`[6b6t-MAIN] ${this.bot.username} aktif konuma geçti.`));
            
            // Eski zamanlayıcıları sıfırla ki hafıza şişmesin
            if (this.portalTimer) clearInterval(this.portalTimer);
            this.isExecuting = false;

            // index.js'deki şifrenle otomatik giriş yapar
            setTimeout(() => {
                if (this.bot && this.bot.chat) {
                    console.log(color.cyan(`[OTOMASYON] Şifre gönderiliyor...`));
                    this.bot.chat(`/login ${this.options.password}`);
                }
            }, 3000);

            // Gelişmiş portal tarayıcısını başlat
            this.startPortalBehavior();
        });

        // Bağlantı koptuğunda index.js'deki reconnectDelay (60 saniye) süresince bekler
        this.bot.on("end", () => {
            if (this.portalTimer) clearInterval(this.portalTimer);
            const delay = this.options.reconnectDelay || 5000;
            console.log(color.red(`[UYARI] Bağlantı kesildi. ${delay / 1000} saniye sonra yeniden bağlanacak...`));
            setTimeout(() => this.init(), delay);
        });
    }

    startPortalBehavior() {
        // `therealrealguy` mantığındaki gibi hızlı tarama döngüsü (Her 400ms'de bir)
        this.portalTimer = setInterval(() => {
            if (!this.bot || !this.bot.entity || this.isExecuting) return;

            // Çevredeki nether portalı bloklarını radarla bulur
            const portal = this.bot.findBlock({
                matching: (b) => b && (b.name === 'nether_portal' || b.name === 'portal'),
                maxDistance: 32 // 32 blok yarıçapında arama
            });

            if (portal) {
                const dist = this.bot.entity.position.distanceTo(portal.position);
                
                // Botun bakış açısını tam portala odaklar
                this.bot.lookAt(portal.position.offset(0, 1, 0));

                // Portala girdik mi veya dibinde miyiz?
                if (dist <= 1.4) {
                    this.clearMovement(); // Titreşim için düz koşuyu kapat
                    this.perform6b6tEntry();
                } else {
                    // Portala doğru depar atarak koş
                    this.safeControl("forward", true);
                    this.safeControl("sprint", true);
                }
            } else {
                // Etrafta portal kalmadıysa (ışınlandıysak) botu frenle
                this.clearMovement();
            }
        }, 400);
    }

    // O MEŞHUR TİTREŞİMLİ GEÇİŞ (ANTİ-BOT BYPASS)
    perform6b6tEntry() {
        this.isExecuting = true;
        console.log(color.magenta(`[PORTAL] Portala girildi! Titreşim (Glitch) modu aktif.`));
        
        let count = 0;
        const interval = setInterval(() => {
            if (!this.bot) {
                clearInterval(interval);
                return;
            }

            // Çok hızlı şekilde w-s tuş kombinasyonu yaparak sunucu lagını ve bot korumasını deler
            this.safeControl("forward", count % 2 === 0);
            this.safeControl("back", count % 2 !== 0);
            
            count++;
            
            // 20 adım (yaklaşık 4 saniye) çırpınıştan sonra durur
            if (count > 20) {
                clearInterval(interval);
                this.clearMovement(); 
                console.log(color.bgGreen.black(`[BAŞARI] Titreşim tamamlandı. Aktarım/Sıra bekleniyor...`));
                
                // 15 saniye boyunca botu dondurur ki sunucu geçişi tamamlasın
                setTimeout(() => {
                    this.isExecuting = false;
                }, 15000);
            }
        }, 200);
    }
}

module.exports = (options) => new ProBot(options);
