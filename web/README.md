# PVAPINS website (Vercel + Neon)

One login for super admin and users.

- Super admin: add users, download both extensions, follow the admin guide.
- Users: download Capture (and Apply), follow the user guide, then upload a Grammarly session.

## 1. Create a free Neon database

1. Open [https://neon.tech](https://neon.tech) and create a project.
2. Copy the connection string (use the **pooled** URL).

## 2. Local run

```bash
cd web
cp .env.example .env
# fill DATABASE_URL, JWT_SECRET, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 3. Deploy on Vercel

1. Import this repo.
2. Set **Root Directory** to `web`.
3. Add the env vars from `.env.example`.
4. Optional: set `NEXT_PUBLIC_APP_URL` to `https://your-app.vercel.app` so downloaded extensions come prefilled with the API URL.
5. Later, to use a separate backend, implement [public/openapi.yaml](./public/openapi.yaml) (Swagger at `/docs`) and set `NEXT_PUBLIC_API_BASE_URL` to that API origin with no trailing slash.
6. Deploy. The build packs the extension zips and runs `prisma migrate deploy`.
