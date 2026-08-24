# Deploying LetMessage

> This project is already live:
> **front-end** https://letmessege-client.vercel.app ·
> **API** https://letmessage-api.onrender.com
>
> What follows is how it was put together, and how to reproduce it.

Three pieces: a database (MongoDB Atlas), the API (Render), and the front-end
(Vercel).

> **Do them in this order.** The API needs to know the front-end's URL for CORS,
> and the front-end needs to know the API's URL — so you deploy the API first,
> then the front-end, then come back and fill in the API's `CLIENT_URL`. Getting
> this wrong is the single most common reason a deployed chat app connects to
> nothing.

---

## 1. Database — MongoDB Atlas

1. **Create a cluster** — *Build a Database* → **M0 (Free)** → pick the region
   closest to where you'll run the API.
2. **Create a database user** — *Database Access* → *Add New Database User*.
   Username/password auth. Use the **Autogenerate Secure Password** button and
   copy the password somewhere safe; Atlas will not show it again.
3. **Allow network access** — *Network Access* → *Add IP Address* →
   **Allow access from anywhere** (`0.0.0.0/0`).

   Render's free tier does not offer static outbound IPs, so there is no
   narrower range to allow. The database is still protected by the user
   password — but keep that password strong, and never commit it.
4. **Copy the connection string** — *Database* → *Connect* → *Drivers*. It looks
   like:

   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

   Replace `<password>` with the real password and add the database name before
   the `?`:

   ```
   mongodb+srv://appuser:REALPASSWORD@cluster0.xxxxx.mongodb.net/letmessage?retryWrites=true&w=majority
   ```

   That `/letmessage` matters — without it everything lands in a database called
   `test`.

---

## 2. API — Render

*New* → **Blueprint** → pick this repository. `render.yaml` sets the root
directory, build and start commands, health check, and generates the JWT
secrets for you.

Fill in the two values it asks for:

| Variable | Value |
|---|---|
| `MONGODB_URI` | the Atlas string from step 1 |
| `CLIENT_URL` | put `http://localhost:5173` for now — you'll correct it in step 4 |

Deploy, then confirm the API is alive:

```
https://<your-service>.onrender.com/api/health
```

It should answer `{"success":true,"data":{"status":"ok",...}}`.

> **Free tier:** the service sleeps after ~15 minutes idle, so the first request
> after a pause takes 30–60 seconds to wake it. Worth a line in your CV notes so
> a reviewer isn't surprised.

---

## 3. Front-end — Vercel

*Add New* → *Project* → import this repository.

| Setting | Value |
|---|---|
| **Root Directory** | `client` |
| Framework | Vite (detected automatically) |
| Build command | `npm run build` (default) |
| Output directory | `dist` (default) |

Add one environment variable:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://<your-service>.onrender.com` — **no trailing slash** |

Deploy. Note the URL you get, e.g. `https://letmessage.vercel.app`.

> `VITE_*` variables are baked into the bundle at build time, not read at
> runtime. Changing this value later means triggering a fresh deploy.

---

## 4. Close the loop

Go back to Render → your service → *Environment* and set:

| Variable | Value |
|---|---|
| `CLIENT_URL` | your Vercel URL, e.g. `https://letmessage.vercel.app` |

Save — Render redeploys automatically.

`CLIENT_URL` accepts a comma-separated list, so you can allow a custom domain
too:

```
https://letmessage.vercel.app,https://chat.yourdomain.com
```

It gates both the REST CORS check and the WebSocket handshake. If messages load
but never arrive live, this is almost always the culprit.

---

## 5. Seed the demo account

The demo sign-in button needs the seeded user to exist. Either run it against
Atlas from your own machine:

```bash
MONGODB_URI="<your atlas string>" npm run seed --workspace server
```

…or from Render's *Shell* tab:

```bash
npm run seed
```

Creates `demo@test.com / 123456`, four teammates, and a set of conversations.

---

## 6. Check it works

1. Open the Vercel URL and click **Enter with the demo account**.
2. Open the same URL in a second browser (or a private window) and sign in as
   `layla@test.com / password123`.
3. Send a message from one and watch it land in the other, with the typing
   indicator and the green presence dot.

If step 3 fails while the conversation list loads fine, the WebSocket is being
blocked — recheck `CLIENT_URL` (step 4) and that `VITE_API_URL` has no trailing
slash.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Sign-in hangs, then a network error | API asleep on the free tier — wait a minute and retry |
| “Demo account is not seeded yet” | Step 5 hasn't been run |
| Conversations load but messages never arrive live | `CLIENT_URL` doesn't match the front-end origin exactly (scheme, subdomain, no trailing slash) |
| CORS error in the console | Same as above |
| `MongooseServerSelectionError` in Render logs | Atlas Network Access is missing `0.0.0.0/0`, or the password in the URI is wrong / not URL-encoded |
| Password has `@`, `:`, `/` or `#` in it | URL-encode it, or regenerate a password without those characters |
| Uploads vanish after a redeploy | Cloudinary is not configured. Render's disk lives and dies with the container: it is wiped on every deploy **and** after ~15 minutes of inactivity, when a free instance is torn down. Set the three `CLOUDINARY_*` variables — the code switches over on its own, no code change needed |
