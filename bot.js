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
        // index.js'den gelen tüm ayarları alıyoruz ve crack giriş için 'offline' modunu zorluyoruz
        const botSettings = {
            ...this.options,
            auth: 'offline', // 6b6t için zorunlu crack modu
            hideErrors: true
        };

        this.bot = mineflayer.createBot(botSettings);
        
        // --- ADMİN DOKUNUŞU: DİNAMİK BARITONE YÜKLEME (HATAYI KÖKTEN ÇÖZER) ---
        try {
            const rawBaritone = require('@miner-org/mineflayer-baritone');
            // Modülün nasıl ihraç edildiğini (default mu, fonksiyon mu) runtime'da çözüyoruz
            const baritonePlugin = rawBaritone.baritone || rawBaritone.default || rawBaritone;
            
            if (typeof baritonePlugin === 'function') {
                this.bot.loadPlugin(baritonePlugin);
            } else {
                console.log(color.yellow(`[UYARI] Baritone fonksiyon olarak çözülemedi, düz hareket motoru aktif.`));
            }
        } catch (err) {
            console.log(color.red(`[HATA] Baritone yüklenirken bir sorun oluştu: ${err.message}`));
        }

        this.setupEvents();
    }

    // --- ENGELLERE VE GEÇİCİ KİLİTLENMELERE KARŞI HAREKET MOTORU ---
    safeControl(action, state) {
        if (this.bot && this.bot.controlState) {
            try {
                this.bot.setControlState(action, state);
            } catch (e) { /* Hataları yut */ }
        }
    }

    // Botun tüm kas hafızasını sıfırlama (Portala girince boşa koşmasın diye)
    clearMovement() {
        const actions = ["forward", "back", "left", "right", "jump", "sprint"];
        actions.forEach(action => this.safeControl(action, false));
    }

    setupEvents() {
        // Bot her dünyaya girdiğinde (Lobi -> Sıra -> Ana Sunucu geçişlerinde) tetiklenir
        this.bot.on("spawn", async () => {
            console.log(color.green(`[BOT] ${this.bot.username} sunucuya/boyuta başarıyla giriş yaptı.`));
            
            // Üst üste binmiş eski portal arama döngüleri varsa temizle
            if (this.portalTimer) clearInterval(this.portalTimer);
            this.isExecuting = false;

            // index.js dosyasındaki şifreni otomatik okur ve 3 saniye sonra gönderir
            setTimeout(() => {
                if (this.bot && this.bot.chat) {
                    console.log(color.cyan(`[SİSTEM] Giriş komutu gönderiliyor...`));
                    this.bot.chat(`/login ${this.options.password}`);
                }
            }, 3000);

            // Portalları aramaya başla
            this.startPortalBehavior();
        });

        // Bot sunucudan düşerse index.js'deki reconnectDelay (60 saniye) kadar bekler ve yeniden başlar
        this.bot.on("end", () => {
            if (this.portalTimer) clearInterval(this.portalTimer);
            const delay = this.options.reconnectDelay || 5000;
            console.log(color.red(`[BOT] Bağlantı koptu. ${delay / 1000} saniye sonra yeniden denenecek...`));
            setTimeout(() => this.init(), delay);
        });
    }

    startPortalBehavior() {
        // Her yarım saniyede bir etrafı radar gibi tarar
        this.portalTimer = setInterval(() => {
            if (!this.bot || !this.bot.entity || this.isExecuting) return;

            // 6b6t sürümüne göre 'nether_portal' ya da düz 'portal' arar
            const portal = this.bot.findBlock({
                matching: (b) => b && (b.name === 'nether_portal' || b.name === 'portal'),
                maxDistance: 32 // 32 blok çapında arar
            });

            if (portal) {
                const dist = this.bot.entity.position.distanceTo(portal.position);
                
                // Botun kafasını tam portala çevirir
                this.bot.lookAt(portal.position.offset(0, 1, 0));

                // Portala yaklaştık mı? (1.5 blok mesafe idealdir)
                if (dist <= 1.5) {
                    this.clearMovement(); // Koşmayı bırak, yoksa ileri geri titreyemez
                    this.perform6b6tEntry();
                } else {
                    // Uzaktaysa portala doğru depar at
                    this.safeControl("forward", true);
                    this.safeControl("sprint", true);
                }
            } else {
                // Etrafta portal yoksa botu durdur, boşa ileri koşup haritada kaybolmasın
                this.clearMovement();
            }
        }, 500);
    }

    // 6b6t BOTLARININ O MEŞHUR "TİTREŞİMLİ" GİRİŞİ
    perform6b6tEntry() {
        this.isExecuting = true;
        console.log(color.magenta(`[6b6t] Portala temas etti! Anti-cheat bypass (Titreşim) başlatılıyor...`));
        
        let count = 0;
        const interval = setInterval(() => {
            if (!this.bot) {
                clearInterval(interval);
                return;
            }

            // Çift sayılarda ileri, tek sayılarda geri basarak sunucu paketlerini manipüle eder
            this.safeControl("forward", count % 2 === 0);
            this.safeControl("back", count % 2 !== 0);
            
            count++;
            
            // 20 adım (yaklaşık 4 saniye) titreşimden sonra durur ve sunucunun aktarmasını bekler
            if (count > 20) {
                clearInterval(interval);
                this.clearMovement(); // Hareketleri sıfırla sıraya gir
                console.log(color.bgGreen.black(`!! BAŞARILI: PORTALDA AKTARIM VEYA QUEUE BEKLENİYOR !!`));
                
                // Yeni dünyaya geçene kadar botun tekrar sapıtmaması için 15 saniyelik emniyet kilidi
                setTimeout(() => {
                    this.isExecuting = false;
                }, 15000);
            }
        }, 200);
    }
}

// index.js'in botu tetikleyebilmesi için dışa aktarıyoruz
module.exports = (options) => new ProBot(options);
