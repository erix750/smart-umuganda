# Smart Umuganda

Smart Umuganda is a community-work app served by a Node.js server and backed by Supabase Auth, Postgres, and private Storage.

## Configure Supabase

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL Editor.
3. In Supabase Authentication, create an account for each approved leader. Disable public sign-ups.
4. In the SQL Editor, insert an active `leader_profiles` row for each approved Auth user. Replace the UUID and display name below with that user's Auth ID and name:

	```sql
	insert into public.leader_profiles (user_id, display_name, role, active)
	values ('AUTH-USER-UUID', 'Leader Name', 'leader', true);
	```
5. Copy `.env.example` to `.env` for local use and set `SUPABASE_URL` and `SUPABASE_ANON_KEY` from Supabase Project Settings > API. The app does not use a service-role key.

## Run locally

Install Node.js 20 or later, then run:

```powershell
npm ci
npm start
```

Open `http://localhost:3000`. Leaders sign in using the email/password created in Supabase Auth. In production, set the same environment values privately on the HTTPS Node.js host; set `NODE_ENV=production`. If HTTPS terminates at a trusted reverse proxy, also set `TRUST_PROXY=1`.

## Security boundary

Leader passwords are verified by Supabase Auth. The server keeps Supabase access/refresh tokens in HttpOnly, SameSite=Strict cookies and forwards the user's JWT to Postgres/Storage. Row-level security allows only active leader profiles to access community data; avatar files are private and scoped to the owning leader. No service-role key is used in the app.

GitHub Pages cannot run the server and is not an appropriate host for the authenticated app. This is a security-focused prototype, not a claim of MINALOC approval or production readiness. Community data is currently one JSON document, so concurrent edits can overwrite each other. Before use with real nationwide data, normalize records into relational tables, add audit history and operational backups/monitoring, and complete independent security, privacy, and MINALOC reviews. SMS is intentionally left as an integration point for MINALOC's chosen provider.