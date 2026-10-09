(() => {
	const key = "smart-umuganda-system-v1";
	const textSizeKey = "smart-umuganda-text-size-v1";
	const seed = window.SMART_UMUGANDA_SEED || { activities: [], tasks: [] };
	const defaultMessage = "Baturage, turabatumira mu muganda rusange wo ku wa Gatandatu. Tuzahurira ku biro by'akagari saa moya za mu gitondo. Twese hamwe twubake u Rwanda rwacu.";
	const state = {
		citizens: [{ id: "c1", name: "Umutoni Marie", phone: "+250 788 000 001", district: "Gasabo", sector: "Remera", cell: "Rukiri I", village: "Amahoro", age: 28, category: "Adult", joined: "2026-09-10" }],
		activities: seed.activities.map((item) => ({ ...item })),
		tasks: seed.tasks.map((item) => ({ ...item })),
		attendance: [{ id: "p1", citizen: "Umutoni Marie", activity: "Gufasha abatishoboye", date: "2026-10-03", checkIn: "08:52", status: "Present" }],
		reports: [{ id: "r1", activity: "Gufasha abatishoboye", location: "Kacyiru, Gasabo", date: "2026-10-03", participants: 124, workDone: "Inzu 4 zarasanwe, imiryango 12 yahawe ubufasha.", evidence: [], status: "Submitted", submittedBy: "Umuyobozi wa Kacyiru" }],
		role: "citizen", name: "Umutoni Marie", message: defaultMessage
	};
	try { localStorage.removeItem(key); } catch {}
	let language = "en";
	let view = "dashboard";
	let authenticatedLeader = null;
	let toastTimer;
	let stateSyncQueue = Promise.resolve();
	const titles = { dashboard: "Home / Dashboard", registration: "Citizen registration", activities: "Umuganda activities", participation: "Participation & check-in", tasks: "Community tasks", reports: "Reports & evidence", leaders: "Leader dashboard", national: "Head admin / Minister" };
	const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
	const icon = (name) => `<i data-lucide="${name}"></i>`;
	const today = () => new Date().toISOString().slice(0, 10);
	const dateLabel = (value) => value ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)) : "—";
	const orderedActivities = () => [...state.activities].sort((a, b) => a.date.localeCompare(b.date));
	const upcoming = () => orderedActivities().filter((item) => item.date >= today() && item.status !== "Completed");
	function save() {
		if (!authenticatedLeader) return;
		const payload = JSON.stringify({ citizens: state.citizens, activities: state.activities, tasks: state.tasks, attendance: state.attendance, reports: state.reports, message: state.message });
		stateSyncQueue = stateSyncQueue.then(async () => {
			const response = await fetch("/api/state", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: payload });
			if (!response.ok) {
				const result = await response.json().catch(() => ({}));
				throw new Error(result.error || "Could not save shared community data.");
			}
		}).catch((error) => toast(error.message || "Could not save shared community data."));
	}
	async function loadSharedState() {
		const response = await fetch("/api/state", { credentials: "same-origin", cache: "no-store" });
		if (!response.ok) {
			const result = await response.json().catch(() => ({}));
			throw new Error(result.error || "Could not load shared community data.");
		}
		const shared = await response.json();
		if (!shared) return false;
		state.citizens = shared.citizens;
		state.activities = shared.activities;
		state.tasks = shared.tasks;
		state.attendance = shared.attendance;
		state.reports = shared.reports;
		state.message = shared.message;
		return true;
	}
	function toast(message) { const el = document.querySelector("#system-toast"); el.textContent = message; el.classList.add("visible"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("visible"), 2600); }
	function icons() { if (window.lucide) window.lucide.createIcons(); }
	function heading(kicker, title, description, button = "") { return `<div class="page-heading"><div><p class="system-kicker">${kicker}</p><h1>${title}</h1><p class="page-description">${description}</p></div>${button}</div>`; }
	function stat(label, value, sub, iconName, tone) { return `<article class="overview-stat ${tone}"><div class="overview-stat-head"><span>${label}</span><span class="overview-stat-icon">${icon(iconName)}</span></div><strong>${value}</strong><small>${sub}</small></article>`; }
	function activityRows(items = orderedActivities()) {
		return items.length ? items.map((a) => `<tr><td><strong>${esc(a.name)}</strong><small>${esc(a.description)}</small></td><td>${esc(a.location)}</td><td>${dateLabel(a.date)}<small>${esc(a.time)}</small></td><td><span class="status-tag ${a.status === "Completed" ? "done" : "planned"}">${esc(a.status || "Planned")}</span></td><td>${Number(a.participants) || 0}</td><td><button class="table-action" data-checkin="${esc(a.id)}">Check in ${icon("arrow-up-right")}</button></td></tr>`).join("") : `<tr><td colspan="6" class="table-empty">No activities yet.</td></tr>`;
	}
	function citizenRows(items) {
		return items.length ? items.map((p) => `<tr><td><strong>${esc(p.name)}</strong></td><td>${esc(p.phone)}</td><td>${esc(p.village)}, ${esc(p.cell)}<small>${esc(p.sector)}, ${esc(p.district)}</small></td><td><span class="status-tag neutral">${esc(p.category)}</span></td><td>${dateLabel(p.joined)}</td></tr>`).join("") : `<tr><td colspan="5" class="table-empty">No citizens registered.</td></tr>`;
	}
	function attendanceRows(items = [...state.attendance].reverse()) {
		return items.length ? items.map((a) => `<tr><td><strong>${esc(a.citizen)}</strong></td><td>${esc(a.activity)}</td><td>${dateLabel(a.date)}</td><td>${esc(a.checkIn || "—")}</td><td><select data-status="${esc(a.id)}" class="inline-status" aria-label="Participant status"><option ${a.status === "Present" ? "selected" : ""}>Present</option><option ${a.status === "Late" ? "selected" : ""}>Late</option><option ${a.status === "Excused" ? "selected" : ""}>Excused</option><option ${a.status === "Absent" ? "selected" : ""}>Absent</option></select></td></tr>`).join("") : `<tr><td colspan="5" class="table-empty">No attendance records.</td></tr>`;
	}
	function dashboard() {
		const next = upcoming()[0];
		return `${heading("UMUGANDA NI UWACU", `Muraho, ${esc(state.name.split(" ")[0])} <span class="heading-flower">✳</span>`, "Good things happen when we show up for each other.", `<button class="system-button primary" data-go="activities">${icon("plus")} Find an activity</button>`)}<div class="overview-stats">${stat("Upcoming activities", upcoming().length, "In your community", "calendar-days", "green")}${stat("Citizens registered", state.citizens.length, "Community members", "users-round", "peach")}${stat("Attendance records", state.attendance.length, "Participation tracked", "clipboard-check", "blue")}${stat("Reports submitted", state.reports.length, "Work documented", "file-check-2", "yellow")}</div><div class="dashboard-columns"><section class="system-panel"><div class="panel-heading"><div><p class="system-kicker">MARK YOUR CALENDAR</p><h2>Upcoming Umuganda</h2></div><button class="plain-link" data-go="activities">All activities ${icon("arrow-right")}</button></div>${next ? `<article class="next-activity"><div class="calendar-tile"><small>${dateLabel(next.date).split(" ")[1]}</small><strong>${new Date(`${next.date}T12:00:00`).getDate()}</strong></div><div class="next-activity-copy"><span class="status-tag planned">${esc(next.status)}</span><h3>${esc(next.name)}</h3><p>${icon("map-pin")}${esc(next.location)} · ${icon("clock-3")}${esc(next.time)}</p><small>${esc(next.description)}</small></div></article>` : `<div class="blank-state">No upcoming activity is scheduled yet.</div>`}</section><section class="system-panel"><div class="panel-heading"><div><p class="system-kicker">GET STARTED</p><h2>Quick actions</h2></div></div><div class="quick-action-grid"><button data-go="registration">${icon("user-round-plus")}<span>Register citizen</span>${icon("arrow-up-right")}</button><button data-go="participation">${icon("scan-line")}<span>Check in attendance</span>${icon("arrow-up-right")}</button><button data-go="tasks">${icon("list-checks")}<span>Community tasks</span>${icon("arrow-up-right")}</button><button data-go="reports">${icon("file-plus-2")}<span>Submit a report</span>${icon("arrow-up-right")}</button></div></section></div><section class="system-panel table-panel"><div class="panel-heading"><div><p class="system-kicker">COMMUNITY CALENDAR</p><h2>Coming up</h2></div><button class="plain-link" data-go="activities">View all ${icon("arrow-right")}</button></div><div class="table-scroll"><table><thead><tr><th>Activity</th><th>Location</th><th>Date & time</th><th>Status</th><th>Participants</th><th></th></tr></thead><tbody>${activityRows(upcoming().slice(0, 3))}</tbody></table></div></section><section class="sms-ribbon"><span class="sms-icon">${icon("message-circle")}</span><div><strong>Kinyarwanda SMS updates</strong><p>Community reminders in plain text, designed for any mobile phone.</p></div><span class="sms-status">${icon("radio-tower")} SMS-ready</span></section>`;
	}
	function registration() {
		return `${heading("JOIN YOUR COMMUNITY", "Citizen registration", "Register a citizen and connect them with activities in their area.")}<div class="form-layout"><form class="system-panel system-form" id="citizen-form"><div class="form-section-heading"><span class="form-step">01</span><div><h2>Personal details</h2><p>Enter details as provided by the citizen.</p></div></div><div class="form-grid"><label class="field-label full">Full name<input name="name" required maxlength="100" placeholder="Citizen's full name" /></label><label class="field-label">Phone number<input name="phone" type="tel" required pattern="[+0-9 ()-]{9,18}" placeholder="+250 7XX XXX XXX" /></label><label class="field-label">Age<input name="age" type="number" min="1" max="120" required placeholder="Age in years" /></label><label class="field-label">Age category<select name="category" required><option value="">Choose category</option><option>Youth</option><option>Adult</option><option>Older adult</option></select></label><label class="field-label">District<input name="district" required placeholder="District" /></label><label class="field-label">Sector<input name="sector" required placeholder="Sector" /></label><label class="field-label">Cell<input name="cell" required placeholder="Cell" /></label><label class="field-label">Village<input name="village" required placeholder="Village" /></label><label class="check-row full"><input name="smsConsent" type="checkbox" required /><span>I agree to receive Umuganda reminders by SMS.</span></label></div><div class="form-submit-row"><p>${icon("lock-keyhole")} Phone used for community coordination.</p><button class="system-button primary">Register citizen ${icon("arrow-right")}</button></div></form><aside class="system-panel registration-aside"><span class="aside-icon">${icon("users-round")}</span><p class="system-kicker">COMMUNITY ROSTER</p><strong>${state.citizens.length} registered citizens</strong><p>Registration helps local leaders plan activities and send community reminders.</p><div class="aside-mini-list"><span>${icon("map-pin")} Location by district, sector, cell and village</span><span>${icon("message-square-text")} SMS consent recorded</span></div></aside></div><section class="system-panel table-panel"><div class="panel-heading"><div><p class="system-kicker">REGISTERED MEMBERS</p><h2>Recent citizens</h2></div><label class="table-search">${icon("search")}<input id="citizen-search" placeholder="Search name or phone" /></label></div><div class="table-scroll"><table><thead><tr><th>Name</th><th>Phone</th><th>Location</th><th>Age group</th><th>Registered</th></tr></thead><tbody id="citizen-rows">${citizenRows(state.citizens.slice().reverse())}</tbody></table></div></section>`;
	}
	function activitiesView() {
		return `${heading("PLAN AND PARTICIPATE", "Umuganda activities", "Find community work or create a new activity for your area.", state.role === "citizen" ? "" : `<button class="system-button primary" data-action="new-activity">${icon("plus")} Create activity</button>`)}<div class="overview-stats compact-stats">${stat("Scheduled", upcoming().length, "Upcoming activities", "calendar-clock", "green")}${stat("Completed", state.activities.filter((a) => a.status === "Completed").length, "Work recorded", "circle-check", "peach")}${stat("Expected participants", state.activities.reduce((n, a) => n + Number(a.participants || 0), 0), "Across activities", "users-round", "blue")}</div><section class="system-panel table-panel"><div class="panel-heading"><div><p class="system-kicker">COMMUNITY CALENDAR</p><h2>Activities in your area</h2></div><label class="table-search">${icon("search")}<input id="activity-search" placeholder="Search activities" /></label></div><div class="table-scroll"><table><thead><tr><th>Activity</th><th>Location</th><th>Date & time</th><th>Status</th><th>Participants</th><th></th></tr></thead><tbody id="activity-rows">${activityRows()}</tbody></table></div></section>`;
	}
	function participation() {
		return `${heading("ATTENDANCE", "Participation & check-in", "Record attendance for an Umuganda activity and update participant status.")}<div class="checkin-layout"><form class="system-panel system-form" id="checkin-form"><div class="form-section-heading"><span class="form-step">02</span><div><h2>Check in a participant</h2><p>Select an activity and registered citizen.</p></div></div><div class="form-grid"><label class="field-label full">Umuganda activity<select name="activityId" required><option value="">Choose activity</option>${orderedActivities().map((a) => `<option value="${esc(a.id)}">${esc(a.name)} · ${dateLabel(a.date)}</option>`).join("")}</select></label><label class="field-label full">Citizen<select name="citizenId" required><option value="">Choose registered citizen</option>${state.citizens.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.phone)}</option>`).join("")}</select></label><label class="field-label">Participant status<select name="status"><option>Present</option><option>Late</option><option>Excused</option><option>Absent</option></select></label><label class="field-label">Check-in time<input name="checkIn" type="time" value="${new Date().toTimeString().slice(0, 5)}" /></label></div><button class="system-button primary form-wide-button">Record attendance ${icon("clipboard-check")}</button></form><aside class="system-panel attendance-aside"><span class="aside-icon">${icon("scan-line")}</span><p class="system-kicker">ATTENDANCE TRACKING</p><strong>Clear records, stronger participation.</strong><p>Check-in status is stored with the activity and citizen.</p><div class="attendance-today"><span>Attendance records</span><strong>${state.attendance.length}</strong></div></aside></div><section class="system-panel table-panel"><div class="panel-heading"><div><p class="system-kicker">PARTICIPATION RECORDS</p><h2>Recent attendance</h2></div><label class="table-search">${icon("search")}<input id="attendance-search" placeholder="Search participant or activity" /></label></div><div class="table-scroll"><table><thead><tr><th>Participant</th><th>Activity</th><th>Date</th><th>Check-in</th><th>Status</th></tr></thead><tbody id="attendance-rows">${attendanceRows()}</tbody></table></div></section>`;
	}
	function tasks() {
		return `${heading("WORK TO DO, TOGETHER", "Community tasks", "Coordinate the small jobs that help an Umuganda activity run smoothly.", state.role === "citizen" ? "" : `<button class="system-button primary" data-action="new-task">${icon("plus")} Add task</button>`)}<div class="task-board">${["Open", "In progress", "Done"].map((status) => `<section class="task-column"><div class="task-column-heading"><i class="task-status-dot ${status.toLowerCase().replace(" ", "-")}"></i><strong>${status}</strong><span>${state.tasks.filter((t) => t.status === status).length}</span></div>${state.tasks.filter((t) => t.status === status).map((t) => `<article class="task-item"><span class="task-category">COMMUNITY TASK</span><h3>${esc(t.title)}</h3><p>${icon("map-pin")}${esc(t.location)}</p><div class="task-item-foot"><span>${dateLabel(t.due)}</span><select data-task="${esc(t.id)}" aria-label="Task status"><option ${t.status === "Open" ? "selected" : ""}>Open</option><option ${t.status === "In progress" ? "selected" : ""}>In progress</option><option ${t.status === "Done" ? "selected" : ""}>Done</option></select></div><small>Assigned to ${esc(t.assigned)}</small></article>`).join("") || `<div class="task-empty">Nothing here yet.</div>`}</section>`).join("")}</div>`;
	}
	function reports() {
		return `${heading("DOCUMENT COMMUNITY WORK", "Reports & evidence", "Report participant numbers, completed work and photo evidence after an activity.")}<form class="system-panel system-form report-form" id="report-form"><div class="form-section-heading"><span class="form-step">03</span><div><h2>Submit activity report</h2><p>Show the community what was accomplished.</p></div></div><div class="form-grid"><label class="field-label full">Completed activity<select name="activityId" required><option value="">Select activity</option>${orderedActivities().map((a) => `<option value="${esc(a.id)}">${esc(a.name)} · ${dateLabel(a.date)}</option>`).join("")}</select></label><label class="field-label">Number of participants<input name="participants" type="number" min="0" required placeholder="e.g. 86" /></label><label class="field-label">Location<input name="location" required placeholder="Sector, cell or village" /></label><label class="field-label full">Work completed<textarea name="workDone" rows="4" required maxlength="1000" placeholder="Describe work completed..."></textarea></label><label class="field-label full">Photo evidence<input name="evidence" type="file" accept="image/*" multiple /><small class="field-hint">Photo names are recorded in this browser demo; image uploads need server storage.</small></label><label class="check-row full"><input name="accuracy" type="checkbox" required /><span>I confirm this report reflects the work completed.</span></label></div><div class="form-submit-row"><span></span><button class="system-button primary">Submit report ${icon("send")}</button></div></form><section class="system-panel table-panel"><div class="panel-heading"><div><p class="system-kicker">REPORT ARCHIVE</p><h2>Submitted reports</h2></div><span class="record-count">${state.reports.length} reports</span></div><div class="report-grid">${state.reports.slice().reverse().map((r) => `<article class="report-card"><div class="report-card-head"><span class="report-file-icon">${icon("file-check-2")}</span><span class="status-tag done">${esc(r.status)}</span></div><h3>${esc(r.activity)}</h3><p>${esc(r.location)} · ${dateLabel(r.date)}</p><div class="report-metrics"><span><strong>${Number(r.participants)}</strong> participants</span><span><strong>${(r.evidence || []).length}</strong> photos</span></div><p class="report-work">${esc(r.workDone)}</p>${(r.evidence || []).map((f) => `<span class="evidence-file">${icon("image")}${esc(f)}</span>`).join("")}<small class="report-submitter">Submitted by ${esc(r.submittedBy)}</small></article>`).join("") || `<div class="blank-state">No reports submitted yet.</div>`}</div></section>`;
	}
	function leaders() {
		return `${heading("LOCAL COORDINATION", "Leader dashboard", "Manage local registrations, activities, attendance and reports.", `<button class="system-button primary" data-action="new-activity">${icon("plus")} Create activity</button>`)}<div class="overview-stats">${stat("Registered citizens", state.citizens.length, "Community roster", "users-round", "green")}${stat("Activities planned", upcoming().length, "Upcoming locally", "calendar-days", "peach")}${stat("Attendance records", state.attendance.length, "Participant status", "clipboard-check", "blue")}${stat("Reports submitted", state.reports.length, "Work documented", "file-check-2", "yellow")}</div><section class="system-panel table-panel"><div class="panel-heading"><div><p class="system-kicker">ACTIVITY OVERSIGHT</p><h2>Manage activities and check-ins</h2></div><button class="plain-link" data-go="participation">Open attendance ${icon("arrow-right")}</button></div><div class="table-scroll"><table><thead><tr><th>Activity</th><th>Location</th><th>Date & time</th><th>Status</th><th>Participants</th><th></th></tr></thead><tbody>${activityRows()}</tbody></table></div></section><section class="system-panel table-panel"><div class="panel-heading"><div><p class="system-kicker">COMMUNITY ROSTER</p><h2>Recent citizens</h2></div><button class="plain-link" data-go="registration">Register citizen ${icon("arrow-right")}</button></div><div class="table-scroll"><table><thead><tr><th>Name</th><th>Phone</th><th>Location</th><th>Age group</th><th>Registered</th></tr></thead><tbody>${citizenRows(state.citizens.slice().reverse())}</tbody></table></div></section><section class="system-panel sms-compose"><div class="sms-compose-title"><span class="sms-icon">${icon("message-square-text")}</span><div><p class="system-kicker">COMMUNITY ANNOUNCEMENT</p><h2>Prepare a Kinyarwanda SMS</h2></div></div><label class="field-label">Message<textarea id="community-message" rows="3" maxlength="320">${esc(state.message)}</textarea></label><div class="sms-compose-foot"><span>${icon("smartphone")} Plain text, compatible with basic phones · 320 characters</span><button class="system-button primary" data-action="sms-preview">${icon("send")} Preview SMS</button></div><p class="integration-warning">Preview only: real SMS delivery needs a backend, an SMS gateway and recipient consent.</p></section>`;
	}
	function national() {
		const sectors = new Set(state.citizens.map((c) => c.sector)).size;
		const present = state.attendance.filter((a) => ["Present", "Late"].includes(a.status)).length;
		return `${heading("NATIONAL OVERVIEW", "Head administrator / Minister", "A cross-community view of participation, work completed and local reporting.", `<button class="system-button secondary" data-action="export">${icon("download")} Export overview</button>`)}<div class="overview-stats">${stat("Citizens registered", state.citizens.length, `${sectors} sectors represented`, "users-round", "green")}${stat("Activities scheduled", upcoming().length, "Upcoming system-wide", "calendar-days", "peach")}${stat("Citizens checked in", present, "Present or late", "clipboard-check", "blue")}${stat("Reports submitted", state.reports.length, "Documented activities", "file-check-2", "yellow")}</div><div class="national-grid"><section class="system-panel"><div class="panel-heading"><div><p class="system-kicker">ACTIVITY DELIVERY</p><h2>Activity summary</h2></div><span class="record-count">October 2026</span></div><div class="national-bars">${state.activities.slice(0, 6).map((a) => `<div class="national-bar-row"><span>${esc(a.name)}</span><div class="national-bar-track"><i style="width:${Math.min(Math.max(Number(a.participants) || 10, 10), 100)}%"></i></div><strong>${Number(a.participants) || 0}</strong></div>`).join("")}</div></section><section class="system-panel national-summary"><p class="system-kicker">COMMUNITY PULSE</p><h2>Coverage at a glance</h2><div class="coverage-number">${sectors}<small>sectors represented</small></div><div class="coverage-stat"><span>Completed activities</span><strong>${state.activities.filter((a) => a.status === "Completed").length}</strong></div><div class="coverage-stat"><span>Evidence photos</span><strong>${state.reports.reduce((n, r) => n + (r.evidence || []).length, 0)}</strong></div><div class="coverage-stat"><span>Participation entries</span><strong>${state.attendance.length}</strong></div></section></div><section class="system-panel table-panel"><div class="panel-heading"><div><p class="system-kicker">SUBMITTED BY LOCAL LEADERS</p><h2>National report register</h2></div></div><div class="table-scroll"><table><thead><tr><th>Activity</th><th>Location</th><th>Date</th><th>Participants</th><th>Evidence</th><th>Status</th></tr></thead><tbody>${state.reports.map((r) => `<tr><td><strong>${esc(r.activity)}</strong><small>${esc(r.workDone)}</small></td><td>${esc(r.location)}</td><td>${dateLabel(r.date)}</td><td>${r.participants}</td><td>${(r.evidence || []).length} photos</td><td><span class="status-tag done">${esc(r.status)}</span></td></tr>`).join("")}</tbody></table></div></section>`;
	}
	const viewRenderers = { dashboard, registration, activities: activitiesView, participation, tasks, reports, leaders, national };
		const protectedViews = new Set(["registration", "participation", "reports", "leaders", "national"]);
		function canOpenView(nextView) {
			if (!protectedViews.has(nextView) || authenticatedLeader) return true;
			toast("Sign in with an authorized leader account to open this workspace.");
			return false;
		}
		function resetCommunityState() {
			state.citizens = [{ id: "c1", name: "Umutoni Marie", phone: "+250 788 000 001", district: "Gasabo", sector: "Remera", cell: "Rukiri I", village: "Amahoro", age: 28, category: "Adult", joined: "2026-09-10" }];
			state.activities = seed.activities.map((item) => ({ ...item }));
			state.tasks = seed.tasks.map((item) => ({ ...item }));
			state.attendance = [{ id: "p1", citizen: "Umutoni Marie", activity: "Gufasha abatishoboye", date: "2026-10-03", checkIn: "08:52", status: "Present" }];
			state.reports = [{ id: "r1", activity: "Gufasha abatishoboye", location: "Kacyiru, Gasabo", date: "2026-10-03", participants: 124, workDone: "Inzu 4 zarasanwe, imiryango 12 yahawe ubufasha.", evidence: [], status: "Submitted", submittedBy: "Umuyobozi wa Kacyiru" }];
			state.message = defaultMessage;
		}
	function render() {
		if (protectedViews.has(view) && !authenticatedLeader) view = "dashboard";
		if (view === "leaders" && (!authenticatedLeader || authenticatedLeader.role === "citizen")) view = "dashboard";
		if (view === "national" && (!authenticatedLeader || authenticatedLeader.role !== "minister")) view = "dashboard";
		document.querySelector("#view-container").innerHTML = (viewRenderers[view] || dashboard)();
		document.querySelector("#current-section").textContent = titles[view];
		document.querySelectorAll(".system-nav-link").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
		icons();
	}
	function setRole(role, name) {
		state.role = role; state.name = name || state.name;
		document.querySelector("#user-name").textContent = state.name;
		document.querySelector("#avatar-initials").textContent = state.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
		document.querySelector("#user-role").textContent = ({ citizen: "Citizen", leader: "Sector / cell leader", minister: "Head administrator / Minister" })[role];
		document.querySelector("#role-label").textContent = ({ citizen: "CITIZEN PORTAL", leader: "LOCAL LEADER WORKSPACE", minister: "NATIONAL ADMINISTRATION" })[role];
		document.querySelectorAll(".leader-nav").forEach((el) => el.classList.toggle("visible", role !== "citizen"));
		document.querySelectorAll(".head-nav").forEach((el) => el.classList.toggle("visible", role === "minister"));
		document.querySelector("#profile-photo-button").hidden = !authenticatedLeader;
		document.querySelector("#logout-button").hidden = !authenticatedLeader;
	}
	let profilePictureUrl = "";
	async function loadProfilePicture() {
		const image = document.querySelector("#profile-picture");
		if (profilePictureUrl) URL.revokeObjectURL(profilePictureUrl);
		profilePictureUrl = "";
		image.hidden = true;
		if (!authenticatedLeader?.hasProfilePicture) return;
		try {
			const response = await fetch("/api/profile-picture", { credentials: "same-origin", cache: "no-store" });
			if (!response.ok) return;
			profilePictureUrl = URL.createObjectURL(await response.blob());
			image.src = profilePictureUrl;
			image.hidden = false;
		} catch {
			toast("Could not load your profile picture.");
		}
	}
	function showFormDialog(title, fields, callback) {
		const dialog = document.createElement("dialog"); dialog.className = "system-dialog";
		dialog.innerHTML = `<form><div class="dialog-title-row"><div><p class="system-kicker">COMMUNITY WORK</p><h2>${title}</h2></div><button type="button" class="round-close" data-close>${icon("x")}</button></div>${fields}<div class="dialog-actions"><button type="button" class="system-button secondary" data-close>Cancel</button><button class="system-button primary">Save ${icon("arrow-right")}</button></div></form>`;
		document.body.append(dialog); icons(); dialog.showModal();
		dialog.addEventListener("click", (event) => { if (event.target === dialog || event.target.closest("[data-close]")) dialog.close(); });
		dialog.querySelector("form").addEventListener("submit", (event) => { event.preventDefault(); if (!event.currentTarget.reportValidity()) return; callback(new FormData(event.currentTarget)); dialog.close(); });
		dialog.addEventListener("close", () => dialog.remove(), { once: true });
	}
	function createActivity() {
		showFormDialog("Create Umuganda activity", `<label class="field-label full">Activity name<input name="name" required /></label><div class="dialog-grid"><label class="field-label">Location<input name="location" required /></label><label class="field-label">Date<input name="date" type="date" required min="${today()}" /></label><label class="field-label">Time<input name="time" type="time" required value="08:00" /></label><label class="field-label">Participants expected<input name="participants" type="number" min="0" value="0" /></label></div><label class="field-label full">Description<textarea name="description" required rows="3"></textarea></label>`, (data) => { state.activities.push({ id: `a${Date.now()}`, name: data.get("name").trim(), location: data.get("location").trim(), date: data.get("date"), time: data.get("time"), participants: Number(data.get("participants")) || 0, description: data.get("description").trim(), status: "Planned", evidence: [] }); save(); render(); toast("Activity created."); });
	}
	function createTask() {
		showFormDialog("Add community task", `<label class="field-label full">Task name<input name="title" required /></label><div class="dialog-grid"><label class="field-label">Location<input name="location" required /></label><label class="field-label">Due date<input name="due" type="date" required min="${today()}" /></label><label class="field-label full">Assigned to<input name="assigned" required /></label></div>`, (data) => { state.tasks.push({ id: `t${Date.now()}`, title: data.get("title").trim(), location: data.get("location").trim(), due: data.get("due"), assigned: data.get("assigned").trim(), status: "Open" }); save(); render(); toast("Community task added."); });
	}
	function exportCsv() {
		const rows = [["Activity", "Location", "Date", "Participants", "Work done", "Status"], ...state.reports.map((r) => [r.activity, r.location, r.date, r.participants, r.workDone, r.status])];
		const csv = rows.map((row) => row.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
		const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "smart-umuganda-reports.csv"; link.click(); URL.revokeObjectURL(url); toast("Overview exported as CSV.");
	}

	document.querySelector(".system-nav").addEventListener("click", (event) => { const button = event.target.closest("[data-view]"); if (!button) return;
		if (!canOpenView(button.dataset.view)) return;
		view = button.dataset.view; render(); window.scrollTo({ top: 0, behavior: "smooth" }); });
	document.querySelector("#view-container").addEventListener("click", (event) => {
		const go = event.target.closest("[data-go]"); const action = event.target.closest("[data-action]"); const checkin = event.target.closest("[data-checkin]");
		if (go) { if (!canOpenView(go.dataset.go)) return; view = go.dataset.go; render(); }
		if (action?.dataset.action === "new-activity" && authenticatedLeader) createActivity();
		if (action?.dataset.action === "new-task" && authenticatedLeader) createTask();
		if (action?.dataset.action === "export" && authenticatedLeader?.role === "minister") exportCsv();
		if (checkin && canOpenView("participation")) { view = "participation"; render(); document.querySelector('[name="activityId"]').value = checkin.dataset.checkin; }
		if (action?.dataset.action === "sms-preview") { const text = document.querySelector("#community-message").value.trim(); state.message = text; save(); showFormDialog("SMS message preview", `<div class="sms-preview"><span>${icon("smartphone")} KINYARWANDA · SMS</span><p>${esc(text)}</p><small>${text.length} / 320 characters</small></div><p class="integration-warning">Preview only. No SMS has been sent. Delivery needs an SMS gateway on a secure server.</p>`, () => {}); }
	});
	document.querySelector("#view-container").addEventListener("submit", (event) => {
		event.preventDefault(); const form = event.target; if (!form.reportValidity()) return; const data = new FormData(form);
		if (form.id === "citizen-form" || form.id === "checkin-form" || form.id === "report-form") {
			if (!authenticatedLeader) { toast("Sign in with an authorized leader account before editing community records."); return; }
		}
		if (form.id === "citizen-form") { state.citizens.push({ id: `c${Date.now()}`, name: data.get("name").trim(), phone: data.get("phone").trim(), age: Number(data.get("age")), category: data.get("category"), district: data.get("district").trim(), sector: data.get("sector").trim(), cell: data.get("cell").trim(), village: data.get("village").trim(), joined: today(), smsConsent: data.has("smsConsent") }); save(); render(); toast("Citizen registered on this device."); }
		if (form.id === "checkin-form") { const person = state.citizens.find((p) => p.id === data.get("citizenId")); const activity = state.activities.find((a) => a.id === data.get("activityId")); if (!person || !activity) return; state.attendance.push({ id: `p${Date.now()}`, citizen: person.name, activity: activity.name, date: activity.date, checkIn: data.get("checkIn"), status: data.get("status") }); activity.participants = Number(activity.participants || 0) + 1; save(); render(); toast("Attendance recorded."); }
		if (form.id === "report-form") { const activity = state.activities.find((a) => a.id === data.get("activityId")); const evidence = [...form.elements.evidence.files].map((file) => file.name); const report = { id: `r${Date.now()}`, activity: activity?.name || "Activity", location: data.get("location").trim(), date: activity?.date || today(), participants: Number(data.get("participants")), workDone: data.get("workDone").trim(), evidence, status: "Submitted", submittedBy: state.name }; state.reports.push(report); if (activity) { activity.status = "Completed"; activity.participants = report.participants; activity.workDone = report.workDone; activity.evidence = evidence; } save(); render(); toast("Report saved. Photo filenames are recorded locally; upload needs server storage."); }
	});
	document.querySelector("#view-container").addEventListener("input", (event) => {
		const target = event.target;
		if (target.id === "citizen-search") document.querySelector("#citizen-rows").innerHTML = citizenRows(state.citizens.filter((p) => `${p.name} ${p.phone} ${p.sector}`.toLowerCase().includes(target.value.toLowerCase())));
		if (target.id === "activity-search") document.querySelector("#activity-rows").innerHTML = activityRows(orderedActivities().filter((a) => `${a.name} ${a.location}`.toLowerCase().includes(target.value.toLowerCase())));
		if (target.id === "attendance-search") document.querySelector("#attendance-rows").innerHTML = attendanceRows([...state.attendance].reverse().filter((a) => `${a.citizen} ${a.activity}`.toLowerCase().includes(target.value.toLowerCase())));
	});
	document.querySelector("#view-container").addEventListener("change", (event) => {
		if (event.target.matches("[data-status]")) { const record = state.attendance.find((a) => a.id === event.target.dataset.status); if (record) { record.status = event.target.value; save(); toast("Participant status updated."); } }
		if (event.target.matches("[data-task]")) { const task = state.tasks.find((t) => t.id === event.target.dataset.task); if (task) { task.status = event.target.value; save(); render(); toast("Task status updated."); } }
	});
	const roleDialog = document.querySelector("#role-dialog");
	const roleForm = document.querySelector("#role-form");
	roleForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		const errorMessage = document.querySelector("#login-error");
		const submitButton = roleForm.querySelector('[type="submit"]');
		const formData = new FormData(roleForm);
		errorMessage.hidden = true;
		submitButton.disabled = true;
		try {
			const response = await fetch("/api/login", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username: formData.get("username"), password: formData.get("password") })
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Sign in failed.");
			authenticatedLeader = result;
			setRole(result.role, result.name);
			await loadProfilePicture();
			try { if (!await loadSharedState()) save(); } catch (error) { toast(error.message); }
			view = result.role === "minister" ? "national" : "leaders";
			roleForm.reset();
			roleDialog.close();
			render();
			toast("Signed in securely.");
		} catch (error) {
			errorMessage.textContent = error instanceof TypeError ? "Secure sign-in is unavailable. Open this app through its server." : error.message;
			errorMessage.hidden = false;
		} finally {
			submitButton.disabled = false;
		}
	});
	document.querySelector("#open-role-access").addEventListener("click", () => {
		if (authenticatedLeader) {
			view = authenticatedLeader.role === "minister" ? "national" : "leaders";
			render();
		} else roleDialog.showModal();
	});
	async function restoreLeaderSession() {
		try {
			const response = await fetch("/api/session", { credentials: "same-origin", cache: "no-store" });
			if (!response.ok) return;
			const leader = await response.json();
			authenticatedLeader = leader;
			setRole(leader.role, leader.name);
			await loadProfilePicture();
			try { if (!await loadSharedState()) save(); } catch (error) { toast(error.message); }
			view = leader.role === "minister" ? "national" : "leaders";
			render();
		} catch {
			// The static preview has no auth server; it stays in citizen mode.
		}
	}
	roleDialog.addEventListener("click", (event) => { if (event.target === roleDialog || event.target.closest("[data-close-dialog]")) roleDialog.close(); });
	roleDialog.addEventListener("close", () => { document.querySelector("#login-error").hidden = true; });
	const profilePhotoButton = document.querySelector("#profile-photo-button");
	const profilePhotoInput = document.querySelector("#profile-photo-input");
	profilePhotoButton.addEventListener("click", () => {
		if (document.querySelector("#profile-picture").hidden) profilePhotoInput.click();
		else if (window.confirm("Remove your profile picture? Choose Cancel to replace it.")) {
			fetch("/api/profile-picture", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ remove: true }) }).then((response) => {
				if (!response.ok) throw new Error("Could not remove your profile picture.");
				authenticatedLeader.hasProfilePicture = false;
				loadProfilePicture();
				toast("Profile picture removed.");
			}).catch((error) => toast(error.message));
		}
	});
	profilePhotoInput.addEventListener("change", async () => {
		const file = profilePhotoInput.files[0];
		profilePhotoInput.value = "";
		if (!file) return;
		if (!file.type.startsWith("image/") || file.size > 8_000_000) {
			toast("Choose an image smaller than 8 MB.");
			return;
		}
		try {
			const bitmap = await createImageBitmap(file);
			if (bitmap.width > 6000 || bitmap.height > 6000) throw new Error("Image dimensions are too large.");
			const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
			const canvas = document.createElement("canvas");
			canvas.width = Math.max(1, Math.round(bitmap.width * scale));
			canvas.height = Math.max(1, Math.round(bitmap.height * scale));
			canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
			bitmap.close();
			const image = canvas.toDataURL("image/jpeg", 0.82);
			const response = await fetch("/api/profile-picture", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image }) });
			const result = response.status === 204 ? {} : await response.json();
			if (!response.ok) throw new Error(result.error || "Could not save your profile picture.");
			authenticatedLeader.hasProfilePicture = true;
			await loadProfilePicture();
			toast("Profile picture updated.");
		} catch (error) {
			toast(error.message || "Could not process that image.");
		}
	});
	document.querySelector("#logout-button").addEventListener("click", async () => {
		try {
			await fetch("/api/logout", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" });
		} catch {
			toast("Could not contact the server. Your sign-in may remain active until it expires.");
		}
		authenticatedLeader = null;
		await loadProfilePicture();
		resetCommunityState();
		view = "dashboard";
		setRole(state.role, state.name);
		render();
	});
	const textSizeSelect = document.querySelector("#text-size-select");
	const savedTextSize = localStorage.getItem(textSizeKey) || "1";
	textSizeSelect.value = ["1", "1.15", "1.3"].includes(savedTextSize) ? savedTextSize : "1";
	document.querySelector(".system-root").style.zoom = textSizeSelect.value;
	textSizeSelect.addEventListener("change", () => {
		document.querySelector(".system-root").style.zoom = textSizeSelect.value;
		try { localStorage.setItem(textSizeKey, textSizeSelect.value); } catch { toast("Text size will reset when you close this page."); }
	});
	document.querySelector("#language-select").addEventListener("change", (event) => { language = event.target.value; const text = seed.translations?.[language] || {}; document.querySelectorAll("[data-i18n]").forEach((element) => { if (text[element.dataset.i18n]) element.textContent = text[element.dataset.i18n]; }); document.documentElement.lang = language; render(); });
	setRole(state.role, state.name); render(); restoreLeaderSession();
})();
