# Deployment Guide — ConcreteDSS

Three services: **Frontend → Vercel**, **Backend → Render** (Docker), **Database → Supabase** (already live).

```
Browser ─▶ Vercel (Next.js)  ──/py proxy──▶  Render (FastAPI + ML)
                │
                └── Prisma ──▶ Supabase (Postgres)
```

---

## 1) Push to GitHub

The repo is initialized at the project root (single monorepo: `frontend/` + `backend/`).
`.env*`, `node_modules`, `.venv`, `storage/` are gitignored — secrets are NOT committed.

```bash
cd /Users/main/Workspace/concrete_optimizer
git add -A
git commit -m "ConcreteDSS"
# Create an empty repo on github.com first, then:
git remote add origin https://github.com/<kullanıcı-adın>/concrete-optimizer.git
git branch -M main
git push -u origin main
```

---

## 2) Backend → Render (Docker)

1. [render.com](https://render.com) → sign up (GitHub ile giriş yapabilirsin).
2. **New +** → **Blueprint** → bu repo'yu seç. Render `render.yaml`'ı bulur ve
   `backend/Dockerfile`'ı build eder (veri seti indirilir + model eğitilir — birkaç dakika).
3. Deploy bitince bir URL alırsın, ör. `https://concretedss-backend.onrender.com`.
4. Test et: `https://concretedss-backend.onrender.com/api/health` → model metrikleri dönmeli.

> ⚠️ **Ücretsiz plan:** 15 dk hareketsizlikten sonra uyur; ilk istek ~50 sn sürer (cold start).
> Ayrıca kalıcı disk yoktur → kullanıcıların yüklediği veriler restart'ta silinir (varsayılan
> UCI modeli her zaman çalışır). Kalıcı yükleme için `render.yaml`'daki `disk` bloğunu aç + ücretli plana geç.

---

## 3) Frontend → Vercel

1. [vercel.com](https://vercel.com) → **Add New** → **Project** → bu repo'yu import et.
2. **Root Directory** = `frontend` seç (önemli — repo kökü değil).
3. Framework otomatik **Next.js** algılanır; build ayarlarına dokunma.
4. **Environment Variables** (Settings → Environment Variables) — şunları gir:

| Key | Değer |
| --- | --- |
| `DATABASE_URL` | Supabase transaction pooler string'i (`:6543 ...?pgbouncer=true`) |
| `DIRECT_URL` | Supabase session pooler string'i (`:5432`) |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` ile üret (yenisi olabilir) |
| `NEXTAUTH_URL` | `https://<senin-projen>.vercel.app` (deploy sonrası gerçek domain) |
| `AUTH_TRUST_HOST` | `true` |
| `BACKEND_URL` | `https://concretedss-backend.onrender.com` (2. adımdaki Render URL'i) |

5. **Deploy**. İlk deploy'da `NEXTAUTH_URL` domaini bilemeyebilirsin → deploy bitince
   gerçek domaini öğren, `NEXTAUTH_URL`'i güncelle ve **Redeploy** et.

> Not: `BACKEND_URL` `next.config.ts`'deki `/py` proxy tarafından kullanılır. Tarayıcı
> her zaman Vercel ile aynı origin'e (`/py/...`) konuşur; Vercel sunucusu arka planda
> Render'a yönlendirir → **CORS sorunu olmaz**.

---

## 4) Migration (tablolar zaten var)

Tablolar (`User`, `Scenario`) lokalde `prisma migrate` ile Supabase'de oluşturuldu, yani
hazır. Şema değiştirirsen tekrar `npx prisma migrate deploy` çalıştır.

---

## 5) Doğrulama (canlı)

1. `https://<app>.vercel.app` → ana sayfa açılır.
2. Kayıt ol / giriş yap (Supabase'e yazar).
3. Optimizer → grafik gelir (Vercel → Render proxy çalışıyor demektir).
4. Senaryo kaydet → Dashboard'da görünür.
5. Dataset → dosya yükle → optimizer değişir.

İlk istek yavaşsa Render cold start'tır, birkaç saniye bekle.

---

## Özet env tablosu

**Vercel:** `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `AUTH_TRUST_HOST`, `BACKEND_URL`
**Render:** (otomatik `PORT`; ekstra gerekmez — backend stateless)
**Supabase:** zaten canlı, ekstra ayar yok.
