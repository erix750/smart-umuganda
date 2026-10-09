const path = require("node:path");
require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const { rateLimit } = require("express-rate-limit");
const helmet = require("helmet");

function createApp({ staticDir = __dirname, secureCookies = process.env.NODE_ENV === "production", supabaseUrl = process.env.SUPABASE_URL, supabaseAnonKey = process.env.SUPABASE_ANON_KEY, fetchImpl = fetch } = {}) {
	const app = express();
	app.disable("x-powered-by");
	app.set("trust proxy", process.env.TRUST_PROXY === "1");
	app.use(cookieParser());
	app.use(helmet({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				scriptSrc: ["'self'", "https://unpkg.com"],
				styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
				fontSrc: ["'self'", "https://fonts.gstatic.com"],
				imgSrc: ["'self'", "data:", "https://thumb.wikimedia.org"],
				connectSrc: ["'self'"],
				objectSrc: ["'none'"],
				baseUri: ["'self'"],
				frameAncestors: ["'none'"],
				formAction: ["'self'"],
				upgradeInsecureRequests: secureCookies ? [] : null
			}
		},
		crossOriginResourcePolicy: { policy: "cross-origin" }
	}));
	app.use(express.json({ limit: "1400kb", strict: true }));
	app.get("/healthz", (request, response) => response.json({ status: "ok", supabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey) }));
	const accessCookie = secureCookies ? "__Host-sm-umuganda-access" : "sm-umuganda-access";
	const refreshCookie = secureCookies ? "__Secure-sm-umuganda-refresh" : "sm-umuganda-refresh";
	const accessCookieOptions = { httpOnly: true, secure: secureCookies, sameSite: "strict", path: "/", maxAge: 60 * 60 * 1000 };
	const refreshCookieOptions = { httpOnly: true, secure: secureCookies, sameSite: "strict", path: "/api", maxAge: 30 * 24 * 60 * 60 * 1000 };

	function requireSameOrigin(request, response, next) {
		const origin = request.get("origin");
		const expectedOrigin = `${request.protocol}://${request.get("host")}`;
		if (!origin || origin !== expectedOrigin) return response.status(403).json({ error: "Request origin was rejected." });
		if (!request.is("application/json")) return response.status(415).json({ error: "Send JSON content." });
		next();
	}

	const supabaseRequest = (pathname, options = {}) => fetchImpl(`${supabaseUrl.replace(/\/+$/, "")}${pathname}`, {
		...options,
		headers: { apikey: supabaseAnonKey, "content-type": "application/json", ...options.headers }
	});

	function setAuthCookies(response, auth) {
		response.cookie(accessCookie, auth.access_token, { ...accessCookieOptions, maxAge: Number(auth.expires_in || 3600) * 1000 });
		response.cookie(refreshCookie, auth.refresh_token, refreshCookieOptions);
	}

	function clearAuthCookies(response) {
		response.clearCookie(accessCookie, { ...accessCookieOptions, maxAge: undefined });
		response.clearCookie(refreshCookie, { ...refreshCookieOptions, maxAge: undefined });
	}

	async function getLeaderProfile(accessToken) {
		const userResponse = await supabaseRequest("/auth/v1/user", { headers: { Authorization: `Bearer ${accessToken}` } });
		if (!userResponse.ok) return null;
		const user = await userResponse.json();
		const profileResponse = await supabaseRequest(`/rest/v1/leader_profiles?user_id=eq.${encodeURIComponent(user.id)}&select=display_name,role,active,profile_picture_updated_at`, { headers: { Authorization: `Bearer ${accessToken}` } });
		if (!profileResponse.ok) return null;
		const profiles = await profileResponse.json();
		const profile = profiles[0];
		if (!profile || !profile.active || !["leader", "minister"].includes(profile.role)) return null;
		return { id: user.id, username: user.email, name: profile.display_name, role: profile.role, hasProfilePicture: Boolean(profile.profile_picture_updated_at) };
	}

	async function authenticatedLeader(request, response, { allowRefresh = true } = {}) {
		const accessToken = request.cookies?.[accessCookie];
		if (accessToken && supabaseUrl && supabaseAnonKey) {
			try {
				const profile = await getLeaderProfile(accessToken);
				if (profile) return { ...profile, accessToken };
			} catch {}
		}
		const refreshToken = request.cookies?.[refreshCookie];
		if (!allowRefresh || !refreshToken || !supabaseUrl || !supabaseAnonKey) return null;
		try {
			const result = await supabaseRequest("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) });
			if (!result.ok) return null;
			const auth = await result.json();
			const profile = await getLeaderProfile(auth.access_token);
			if (!profile) return null;
			setAuthCookies(response, auth);
			return { ...profile, accessToken: auth.access_token };
		} catch {
			return null;
		}
	}

	function sharedDataPayload(body) {
		if (!body || typeof body !== "object" || Array.isArray(body)) return null;
		const payload = {
			citizens: body.citizens,
			activities: body.activities,
			tasks: body.tasks,
			attendance: body.attendance,
			reports: body.reports,
			message: body.message
		};
		if (!["citizens", "activities", "tasks", "attendance", "reports"].every((key) => Array.isArray(payload[key]) && payload[key].length <= 10000)) return null;
		if (typeof payload.message !== "string" || payload.message.length > 320) return null;
		return payload;
	}

	app.get("/api/state", async (request, response, next) => {
		response.set("Cache-Control", "no-store");
		const leader = await authenticatedLeader(request, response);
		if (!leader) return response.status(401).json({ error: "Sign in required." });
		if (!supabaseUrl || !supabaseAnonKey) return response.status(503).json({ error: "Supabase is not configured on the server." });
		try {
			const result = await supabaseRequest("/rest/v1/app_state?id=eq.community&select=data", { headers: { Authorization: `Bearer ${leader.accessToken}` } });
			if (result.status === 404 || result.status === 406) return response.json(null);
			if (!result.ok) return response.status(502).json({ error: "Could not load shared community data from Supabase." });
			const rows = await result.json();
			response.json(rows[0]?.data || null);
		} catch (error) {
			next(error);
		}
	});

	app.put("/api/state", requireSameOrigin, async (request, response, next) => {
		response.set("Cache-Control", "no-store");
		const leader = await authenticatedLeader(request, response);
		if (!leader) return response.status(401).json({ error: "Sign in required." });
		if (!supabaseUrl || !supabaseAnonKey) return response.status(503).json({ error: "Supabase is not configured on the server." });
		const data = sharedDataPayload(request.body);
		if (!data) return response.status(400).json({ error: "Community data is invalid or exceeds the allowed limits." });
		try {
			const result = await supabaseRequest("/rest/v1/app_state?on_conflict=id", {
				method: "POST",
				headers: { Authorization: `Bearer ${leader.accessToken}`, Prefer: "resolution=merge-duplicates,return=minimal" },
				body: JSON.stringify({ id: "community", data, updated_by: leader.id, updated_at: new Date().toISOString() })
			});
			if (!result.ok) return response.status(502).json({ error: "Could not save shared community data to Supabase." });
			response.status(204).end();
		} catch (error) {
			next(error);
		}
	});

	app.get("/api/session", async (request, response) => {
		response.set("Cache-Control", "no-store");
		const leader = await authenticatedLeader(request, response);
		if (!leader) return response.status(401).json({ error: "Sign in required." });
		response.json({ username: leader.username, name: leader.name, role: leader.role, hasProfilePicture: leader.hasProfilePicture });
	});

	app.get("/api/profile-picture", async (request, response, next) => {
		response.set("Cache-Control", "private, no-store");
		const leader = await authenticatedLeader(request, response);
		if (!leader) return response.status(401).json({ error: "Sign in required." });
		if (!leader.hasProfilePicture) return response.status(404).end();
		try {
			const result = await supabaseRequest(`/storage/v1/object/leader-avatars/${leader.id}/profile.jpg`, { headers: { Authorization: `Bearer ${leader.accessToken}` } });
			if (!result.ok) return response.status(result.status === 404 ? 404 : 502).end();
			response.type("image/jpeg").send(Buffer.from(await result.arrayBuffer()));
		} catch (error) {
			next(error);
		}
	});

	app.post("/api/profile-picture", requireSameOrigin, async (request, response, next) => {
		response.set("Cache-Control", "no-store");
		const leader = await authenticatedLeader(request, response);
		if (!leader) return response.status(401).json({ error: "Sign in required." });
		try {
			const objectPath = `/storage/v1/object/leader-avatars/${leader.id}/profile.jpg`;
			if (request.body.remove === true) {
				const result = await supabaseRequest(objectPath, { method: "DELETE", headers: { Authorization: `Bearer ${leader.accessToken}` } });
				if (!result.ok) return response.status(502).json({ error: "Could not remove the profile picture." });
			} else {
				const match = typeof request.body.image === "string" && request.body.image.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/);
				if (!match || match[1].length > 1_400_000) return response.status(400).json({ error: "Choose a JPEG image smaller than 1 MB." });
				const image = Buffer.from(match[1], "base64");
				if (image.length < 4 || image.length > 1_000_000 || image[0] !== 0xff || image[1] !== 0xd8 || image[2] !== 0xff) return response.status(400).json({ error: "Choose a valid JPEG image smaller than 1 MB." });
				const result = await supabaseRequest(objectPath, { method: "PUT", headers: { Authorization: `Bearer ${leader.accessToken}`, "Content-Type": "image/jpeg", "x-upsert": "true" }, body: image });
				if (!result.ok) return response.status(502).json({ error: "Could not save the profile picture." });
			}
			const timestamp = request.body.remove === true ? null : new Date().toISOString();
			const update = await supabaseRequest(`/rest/v1/leader_profiles?user_id=eq.${encodeURIComponent(leader.id)}`, { method: "PATCH", headers: { Authorization: `Bearer ${leader.accessToken}`, Prefer: "return=minimal" }, body: JSON.stringify({ profile_picture_updated_at: timestamp }) });
			if (!update.ok) return response.status(502).json({ error: "The profile picture was stored, but its profile update failed." });
			response.status(204).end();
		} catch (error) {
			next(error);
		}
	});

	app.post("/api/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: "draft-8", legacyHeaders: false, handler: (request, response) => response.status(429).json({ error: "Too many sign-in attempts. Wait 15 minutes before trying again." }) }), requireSameOrigin, async (request, response, next) => {
		response.set("Cache-Control", "no-store");
		const email = typeof request.body.username === "string" ? request.body.username.trim().toLowerCase() : "";
		const password = typeof request.body.password === "string" ? request.body.password : "";
		if (!supabaseUrl || !supabaseAnonKey) return response.status(503).json({ error: "Supabase Auth is not configured on the server." });
		if (email.length > 254 || Buffer.byteLength(password) > 1024) return response.status(400).json({ error: "Enter a valid email and password." });
		try {
			const result = await supabaseRequest("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
			if (!result.ok) return response.status(401).json({ error: "Email or password is incorrect." });
			const auth = await result.json();
			const leader = await getLeaderProfile(auth.access_token);
			if (!leader) return response.status(403).json({ error: "This account is not enabled as a community leader." });
			setAuthCookies(response, auth);
			response.json({ username: leader.username, name: leader.name, role: leader.role, hasProfilePicture: leader.hasProfilePicture });
		} catch (error) {
			next(error);
		}
	});

	app.post("/api/logout", requireSameOrigin, async (request, response) => {
		response.set("Cache-Control", "no-store");
		const accessToken = request.cookies?.[accessCookie];
		if (accessToken && supabaseUrl && supabaseAnonKey) {
			try { await supabaseRequest("/auth/v1/logout", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }); } catch {}
		}
		clearAuthCookies(response);
		response.status(204).end();
	});

	const publicFiles = new Set(["index.html", "system.css", "system.js", "database.js"]);
	app.get(["/", "/:filename"], (request, response, next) => {
		const filename = request.path === "/" ? "index.html" : request.params.filename;
		if (!publicFiles.has(filename)) return next();
		response.sendFile(path.join(staticDir, filename), { dotfiles: "deny" }, (error) => { if (error) next(error); });
	});
	app.use((error, request, response, next) => {
		if (response.headersSent) return next(error);
		const status = error.status || error.statusCode || 500;
		response.status(status >= 400 && status < 600 ? status : 500).json({ error: status === 500 ? "The server could not complete the request." : "Invalid request." });
	});

	return { app };
}

if (require.main === module) {
	const { app } = createApp();
	const port = Number(process.env.PORT) || 3000;
	app.listen(port, "0.0.0.0", () => console.log(`Smart Umuganda server listening on port ${port}`));
}

module.exports = { createApp };