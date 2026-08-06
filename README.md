# DietaApp (frontend)

Formularz i tabela produktów (React + TypeScript + Vite).

## Wymagania

- Node.js 20+
- Działający backend DietaApp
- Lokalnie: Postgres przez `docker compose` w repo backendu

## Start (lokalnie)

```bash
cp .env.example .env
npm install
npm run dev
```

Aplikacja: [http://localhost:5173](http://localhost:5173)

Przy pustym `VITE_API_URL` Vite proxy przekierowuje `/api/*` na `http://localhost:8080`.

## Skrypty

- `npm run dev` — tryb developerski
- `npm run build` — build produkcyjny
- `npm test` — Vitest

## API

- `GET /api/categories`
- `GET /api/products`
- `POST /api/products`

## Deploy na Vercel

Szczegółowa checklista: [DEPLOY.md](./DEPLOY.md).

1. Podłącz to repozytorium do [Vercel](https://vercel.com) (framework: Vite).
2. Ustaw zmienną środowiskową:
   - `VITE_API_URL` = `https://<twoja-usługa-backend>.onrender.com` (bez `/` na końcu)
3. Deploy.
4. Skopiuj URL frontu (np. `https://dietaapp-front.vercel.app`) i dodaj go w backendzie do `CORS_ALLOWED_ORIGINS`, potem zredeployuj Render.

### Uwagi

- Proxy Vite działa tylko lokalnie — w produkcji front woła API pod `VITE_API_URL`.
- Darmowy Render może usnąć backend po bezczynności; pierwsze żądanie bywa wolniejsze (~30–60 s).
