const mineflayer = require("mineflayer");
// Baritone eklentisini sorunsuz yüklemek için standart tanımlama
const baritone = require('@miner-org/mineflayer-baritone'); 
const color = require("colors");

class ProBot {
    constructor(options) {
        this.options = options;
        this.isExecuting = false;
        this.portalTimer = null; // Döngüyü kontrol etmek için timer ekledik
        this.init();
    }

    init() {
        this.bot = mineflayer.createBot({ ...this.options, hideErrors: true });
        this.bot.loadPlugin(baritone); // Baritone eklentisini doğru yükle
        this.setupEvents();
    }

    // --- HATA GEÇİRMEZ HAREKET MOTORU ---
    safeControl(action, state) {
        if (this.bot && this.bot.controlState) {
            try {
                this.bot.setControlState(action, state);
            } catch (e) { /* Hata yutuldu */ }
        }
    }

    // Tüm hareketleri anlık olarak sıfırlama fonksiyonu
    clearMovement() {
        const actions = ["forward", "back", "left", "right", "jump", "sprint"];
        actions.forEach(action => this.safeControl(action, false));
    }

    setupEvents() {
        this.bot.on("spawn", async () => {
            console.log(color.green(`[BOT] ${this.bot.username} Sunucuya/Dünyaya giriş yaptı.`));
            
            // Her spawn olduğunda eski portal arama döngüsünü temizle (Çakışmayı önler)
            if (this.portalTimer) clearInterval(this.portalTimer);
            this.isExecuting = false;

            // Giriş komutu
            setTimeout(() => {
                if (this.bot && this.bot.chat) {
                    this.bot.chat(`/login ${this.options.password}`);
                }
            }, 3000);

            // Portal aramayı başlat
            this.startPortalBehavior();
        });

        this.bot.on("end", () => {
            if (this.portalTimer) clearInterval(this.portalTimer);
            console.log(color.red("[BOT] Bağlantı kesildi, 5 saniye sonra yeniden denenecek..."));
            setTimeout(() => this.init(), 5000);
        });
    }

    startPortalBehavior() {
        this.portalTimer = setInterval(() => {
            // Bot hazır değilse veya zaten portala giriş eylemi yapıyorsa arama
            if (!this.bot || !this.bot.entity || this.isExecuting) return;

            // Minecraft'ta portal blok isimleri sürüme göre 'nether_portal' veya 'portal' olabilir
            const portal = this.bot.findBlock({
                matching: (b) => b && (b.name === 'nether_portal' || b.name === 'portal'),
                maxDistance: 32
            });

            if (portal) {
                const dist = this.bot.entity.position.distanceTo(portal.position);
                
                // Portala doğru bak (Kafayı portala çevir)
                this.bot.lookAt(portal.position.offset(0, 1, 0));

                // Portala yeterince yakın mıyız? (Mesafe toleransı 1.5 olarak güncellendi)
                if (dist <= 1.5) {
                    this.clearMovement(); // Yürümeyi durdur ki titreşim düzgün çalışsın
                    this.perform6b6tEntry();
                } else {
                    // Portala doğru koş ve ilerle
                    this.safeControl("forward", true);
                    this.safeControl("sprint", true);
                }
            } else {
                // Eğer etrafta portal yoksa botun boşa koşmasını engelle
                this.clearMovement();
            }
        }, 500);
    }

    // 6b6t BOTLARININ O MEŞHUR "TİTREŞİMLİ" GİRİŞİ
    perform6b6tEntry() {
        this.isExecuting = true;
        console.log(color.magenta(`[6b6t] Portalın içine girildi, titreşim mekanizması tetiklendi...`));
        
        let count = 0;
        const interval = setInterval(() => {
            if (!this.bot) {
                clearInterval(interval);
                return;
            }

            // İleri ve geri tuşlarına milisaniyelik aralarla bas-çek yaparak glitch oluşturur
            this.safeControl("forward", count % 2 === 0);
            this.safeControl("back", count % 2 !== 0);
            
            count++;
            // 20 kez titredikten sonra (yaklaşık 4 saniye) durur ve sunucunun aktarmasını bekler
            if (count > 20) {
                clearInterval(interval);
                this.clearMovement(); // Hareketi tamamen sıfırla
                console.log(color.bgGreen.black(`!! BAŞARILI: PORTALDA AKTARIM BEKLENİYOR !!`));
                
                // Sunucu geçiş yapana kadar botun tekrar hareket etmesini engellemek için 10 saniye bekleme kilidi
                setTimeout(() => {
                    this.isExecuting = false;
                }, 10000);
            }
        }, 200);
    }
}

module.exports = (options) => new ProBot(options);
