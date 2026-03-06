# 🔒 Güvenli İş Suiti

> Yerel, internet bağlantısı gerektirmeyen, güvenli masaüstü iş yönetim uygulaması

![Electron](https://img.shields.io/badge/Electron-2B2E3A?style=for-the-badge&logo=electron&logoColor=9FEAF9)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)

---

## 📋 Proje Özeti

Kurum içi kullanıma yönelik, **internet bağlantısından bağımsız** çalışabilen masaüstü yönetim uygulamasıdır. Çalışanların görevlerini takip edebileceği, süre tutabileceği ve hassas notlarını şifreli şekilde saklayabileceği kapsamlı bir araçtır.

---

## 🛠️ Teknoloji Yığını

| Teknoloji | Kullanım Amacı |
|-----------|---------------|
| **Electron JS** | Masaüstü uygulama çatısı |
| **TypeScript** | Tip güvenli geliştirme |
| **HTML / CSS** | Özgün arayüz tasarımı |
| **better-sqlite3** | Yerel veritabanı |
| **Node.js crypto** | AES-256-GCM şifreleme |
| **Chart.js** | Grafik ve raporlama |

---

## 🏗️ Mimari

```
guvenli-is-suiti/
├── src/
│   ├── main/
│   │   ├── main.ts          ← Electron ana process
│   │   └── preload.ts       ← contextBridge API
│   ├── renderer/
│   │   ├── index.html       ← Ana arayüz
│   │   ├── style.css        ← Özgün koyu tema
│   │   ├── app.js           ← Navigasyon ve event'ler
│   │   ├── kanban.js        ← Modül A
│   │   ├── timer.js         ← Modül B
│   │   ├── vault.js         ← Modül C
│   │   └── reports.js       ← Modül D
│   └── database/
│       └── db.ts            ← SQLite katmanı
├── .github/
│   └── workflows/
│       └── ci.yml           ← GitHub Actions CI/CD
├── eslint.config.js         ← Lint kuralları
├── tsconfig.json
└── package.json
```

### Güvenlik Mimarisi
- ✅ `contextIsolation: true` — Renderer ve Main process tamamen ayrı
- ✅ `nodeIntegration: false` — Renderer'da Node.js erişimi yok
- ✅ Tüm iletişim `contextBridge` + `ipcMain/ipcRenderer` üzerinden

---

## 📦 Modüller

### Modül A — Kanban Görev Yönetimi 📋
- Sürükle-bırak Kanban board (Yapılacak / Sürüyor / Tamamlandı)
- Görev kartı oluştur, düzenle, sil
- Dosya eki ekle — AppData/attachments/`{proje}`/`task_{id}` klasörüne kopyalanır
- Yorum ve not ekleme
- Kart üzerinde dosya/yorum sayacı

### Modül B — Zaman Takibi ⏱️
- Başlat/Durdur zamanlayıcı
- Göreve bağlı zaman kaydı
- Aktivite logu (SQLite)
- Görev kartından ▶ ile direkt başlatma
- System Tray entegrasyonu
- 10 dakika hareketsizlik bildirimi

### Modül C — Şifreli Veri Kasası 🔐
- **AES-256-GCM** şifreleme (Node.js `crypto` modülü)
- **PBKDF2** ile anahtar türetme (100.000 iterasyon)
- Master Key ile kilitleme/açma
- Veriler SQLite'a **plain text olarak DEĞİL** şifreli kaydedilir
- Master Key hiçbir yerde saklanmaz

### Modül D — Raporlama & Dışa Aktarım 📈
- Haftalık çalışma özeti
- Bar grafik (Chart.js) — son 7 günün saatleri
- En çok çalışılan görevler tablosu
- Görev durumu istatistiği
- **PDF İndir** — kullanıcının seçtiği dizine kaydedilir

---

## 🚀 Kurulum

### Gereksinimler
- Node.js 20 LTS
- Git

### Adımlar

```bash
# Repoyu klonla
git clone https://github.com/KULLANICI_ADIN/guvenli-is-suiti.git
cd guvenli-is-suiti

# Bağımlılıkları kur
npm install

# Uygulamayı başlat
npm run dev
```

### Build (Windows .exe)

```bash
npm run build
```

Çıktı `dist/` klasöründe oluşur.

---

## ✅ Teknik Standartlar

| Kriter | Durum |
|--------|-------|
| TypeScript (any tipi yok) | ✅ |
| Strict Context Isolation | ✅ |
| nodeIntegration: false | ✅ |
| better-sqlite3 | ✅ |
| LocalStorage kullanımı yok | ✅ |
| Custom Title Bar | ✅ |
| ESLint lint kontrolü | ✅ |
| GitHub Actions CI/CD | ✅ |

---

## 📁 Veri Depolama

Uygulama verileri Windows AppData klasöründe saklanır:

```
%APPDATA%\guvenli-is-suiti\
├── data\
│   └── guvenli-is-suiti.db   ← SQLite veritabanı
├── attachments\
│   └── {ProjeAdı}\
│       └── task_{id}\        ← Dosya ekleri
└── vault.salt                ← Şifreleme salt dosyası
```

---

## 🔒 Güvenlik Notları

- Vault Master Key **hiçbir yerde saklanmaz** — unutulursa veriler kurtarılamaz
- Şifreli notlar veritabanında `content_encrypted` + `iv` olarak tutulur
- AES-256-GCM authentication tag ile veri bütünlüğü doğrulanır

---

## 👩‍💻 Geliştirici

**Azra** — Güvenli İş Suiti Projesi