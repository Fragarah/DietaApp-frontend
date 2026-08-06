# Deploy checklist — DietaApp

Kolejność: GitHub → Neon → Render → Vercel → CORS → smoke test.

## 1. Neon (Postgres)

1. Załóż konto: https://neon.tech
2. Create project (region EU jeśli jesteś w PL).
3. Skopiuj dane połączenia (host, database, user, password).
4. Złóż JDBC URL:
   `jdbc:postgresql://<host>/<database>?sslmode=require`

## 2. Render (backend)

1. Załóż konto: https://render.com (login przez GitHub).
2. **New → Web Service** → repo `DietaApp-backend`.
3. Runtime: **Docker** (używa `Dockerfile` z repo).
4. Environment variables:
   - `DB_URL` = JDBC z Neona
   - `DB_USER` = user z Neona
   - `DB_PASSWORD` = hasło z Neona
   - `CORS_ALLOWED_ORIGINS` = na start `*` (potem zamień na URL Vercel)
5. Deploy → poczekaj na build.
6. Sprawdź:
   - `https://<app>.onrender.com/api/health`
   - `https://<app>.onrender.com/api/categories`

## 3. Vercel (frontend)

1. Załóż konto: https://vercel.com (login przez GitHub).
2. **Add New Project** → repo `DietaApp-Front`.
3. Framework preset: Vite.
4. Environment variable:
   - `VITE_API_URL` = `https://<app>.onrender.com` (bez `/` na końcu)
5. Deploy.
6. Skopiuj URL frontu (np. `https://....vercel.app`).

## 4. CORS (po Vercel)

1. W Render → Environment ustaw:
   `CORS_ALLOWED_ORIGINS=https://<twoj-front>.vercel.app,http://localhost:5173`
2. Manual Deploy / Restart serwisu.

## 5. Smoke test

1. Otwórz URL Vercel z telefonu / innego PC.
2. **Dodaj produkt** → zapisz.
3. **Tabela produktów** → produkt widoczny.

### Uwagi

- Pierwsze żądanie po uśpieniu Rendera może trwać 30–60 s.
- Bez auth każdy ze znajomością URL może dodawać produkty — auth w kolejnym etapie MVP.
