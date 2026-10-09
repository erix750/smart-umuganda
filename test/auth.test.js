const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { createApp } = require("../server");

const userId = "4f44be9b-b08e-4aa0-a934-12097ed63171";
const accessToken = "mock-access-token";
const refreshToken = "mock-refresh-token";

function createSupabaseMock() {
	const calls = [];
	let savedState = null;
	let avatar = null;
	let avatarUpdatedAt = null;
	let signedOut = false;
	return {
		calls,
		fetch: async (url, options = {}) => {
			const parsed = new URL(url);
			calls.push({ url: parsed, options });
			if (parsed.pathname === "/auth/v1/token" && parsed.searchParams.get("grant_type") === "password") {
				const body = JSON.parse(options.body);
				if (body.password !== "correct horse battery staple") return new Response("{}", { status: 400 });
				return Response.json({ access_token: accessToken, refresh_token: refreshToken, expires_in: 3600 });
			}
			if (parsed.pathname === "/auth/v1/token" && parsed.searchParams.get("grant_type") === "refresh_token") return signedOut ? new Response("{}", { status: 400 }) : Response.json({ access_token: accessToken, refresh_token: refreshToken, expires_in: 3600 });
			if (parsed.pathname === "/auth/v1/user") return signedOut ? new Response("{}", { status: 401 }) : Response.json({ id: userId, email: "leader@example.rw" });
			if (parsed.pathname === "/rest/v1/leader_profiles" && options.method === "PATCH") {
				avatarUpdatedAt = JSON.parse(options.body).profile_picture_updated_at;
				return new Response(null, { status: 204 });
			}
			if (parsed.pathname === "/rest/v1/leader_profiles") return Response.json([{ display_name: "Sector Leader", role: "leader", active: true, profile_picture_updated_at: avatarUpdatedAt }]);
			if (parsed.pathname === "/rest/v1/app_state" && options.method === "POST") {
				savedState = JSON.parse(options.body).data;
				return new Response(null, { status: 201 });
			}
			if (parsed.pathname === "/rest/v1/app_state") return Response.json(savedState ? [{ data: savedState }] : []);
			if (parsed.pathname.startsWith("/storage/v1/object/leader-avatars/")) {
				if (options.method === "PUT") { avatar = Buffer.from(options.body); return new Response(null, { status: 200 }); }
				if (options.method === "DELETE") { avatar = null; return new Response(null, { status: 200 }); }
				if (avatar) return new Response(avatar, { status: 200, headers: { "Content-Type": "image/jpeg" } });
				return new Response("{}", { status: 404 });
			}
			if (parsed.pathname === "/auth/v1/logout") { signedOut = true; return new Response(null, { status: 204 }); }
			return new Response("Not found", { status: 404 });
		}
	};
}

test("Supabase Auth gates shared data and private profile pictures", async (context) => {
	const supabase = createSupabaseMock();
	const { app } = createApp({
		staticDir: path.join(__dirname, ".."),
		secureCookies: false,
		supabaseUrl: "https://example.supabase.co",
		supabaseAnonKey: "public-anon-key",
		fetchImpl: supabase.fetch
	});
	const server = app.listen(0, "127.0.0.1");
	context.after(() => new Promise((resolve) => server.close(resolve)));
	await new Promise((resolve) => server.once("listening", resolve));
	const origin = `http://127.0.0.1:${server.address().port}`;

	assert.equal((await fetch(`${origin}/api/session`)).status, 401);
	assert.equal((await fetch(`${origin}/api/state`)).status, 401);
	assert.equal((await fetch(`${origin}/api/state`, { method: "PUT", headers: { "Content-Type": "application/json", Origin: origin }, body: "{}" })).status, 401);

	const rejectedOrigin = await fetch(`${origin}/api/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Origin: "https://attacker.example" },
		body: JSON.stringify({ username: "leader@example.rw", password: "correct horse battery staple" })
	});
	assert.equal(rejectedOrigin.status, 403);

	const badPassword = await fetch(`${origin}/api/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Origin: origin },
		body: JSON.stringify({ username: "leader@example.rw", password: "incorrect" })
	});
	assert.equal(badPassword.status, 401);

	const login = await fetch(`${origin}/api/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Origin: origin },
		body: JSON.stringify({ username: "leader@example.rw", password: "correct horse battery staple" })
	});
	assert.equal(login.status, 200);
	assert.deepEqual(await login.json(), { username: "leader@example.rw", name: "Sector Leader", role: "leader", hasProfilePicture: false });
	const cookies = login.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
	assert.match(login.headers.get("set-cookie"), /HttpOnly/i);
	assert.match(login.headers.get("set-cookie"), /SameSite=Strict/i);

	const session = await fetch(`${origin}/api/session`, { headers: { Cookie: cookies } });
	assert.equal(session.status, 200);
	assert.equal((await session.json()).role, "leader");
	const emptyState = await fetch(`${origin}/api/state`, { headers: { Cookie: cookies } });
	assert.equal(await emptyState.json(), null);

	const sharedState = { citizens: [], activities: [], tasks: [], attendance: [], reports: [], message: "Umuganda ku wa Gatandatu." };
	const saveState = await fetch(`${origin}/api/state`, {
		method: "PUT",
		headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookies },
		body: JSON.stringify(sharedState)
	});
	assert.equal(saveState.status, 204);
	const savedRequest = supabase.calls.find((call) => call.url.pathname === "/rest/v1/app_state" && call.options.method === "POST");
	assert.equal(savedRequest.options.headers.Authorization, `Bearer ${accessToken}`);
	assert.equal(JSON.parse(savedRequest.options.body).updated_by, userId);
	assert.deepEqual((await (await fetch(`${origin}/api/state`, { headers: { Cookie: cookies } })).json()).message, sharedState.message);

	const badImage = await fetch(`${origin}/api/profile-picture`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookies },
		body: JSON.stringify({ image: "data:image/jpeg;base64,bm90LWEtanBlZw==" })
	});
	assert.equal(badImage.status, 400);
	const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
	const upload = await fetch(`${origin}/api/profile-picture`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookies },
		body: JSON.stringify({ image: `data:image/jpeg;base64,${jpeg.toString("base64")}` })
	});
	assert.equal(upload.status, 204);
	const avatarRequest = supabase.calls.find((call) => call.url.pathname.endsWith(`${userId}/profile.jpg`) && call.options.method === "PUT");
	assert.equal(avatarRequest.options.headers.Authorization, `Bearer ${accessToken}`);
	const photo = await fetch(`${origin}/api/profile-picture`, { headers: { Cookie: cookies } });
	assert.equal(photo.status, 200);
	assert.deepEqual(Buffer.from(await photo.arrayBuffer()), jpeg);

	const logout = await fetch(`${origin}/api/logout`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookies },
		body: "{}"
	});
	assert.equal(logout.status, 204);
	assert.equal((await fetch(`${origin}/api/session`, { headers: { Cookie: cookies } })).status, 401);
	assert.equal((await fetch(`${origin}/api/profile-picture`, { headers: { Cookie: cookies } })).status, 401);
	assert.equal((await fetch(`${origin}/server.js`)).status, 404);
	assert.equal(supabase.calls.some((call) => JSON.stringify(call.options.headers).includes("service_role")), false);
});
