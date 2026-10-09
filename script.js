(() => {
	const activities = [...(window.SMART_UMUGANDA_ACTIVITIES || [])];
	const storageKey = "smart-umuganda-dashboard-v1";
	const categoryLabels = {
		clean: "CLEAN & GREEN",
		learn: "LEARN & GROW",
		care: "CARE & CONNECT"
	};
	const list = document.querySelector("#activity-list");
	const search = document.querySelector("#activity-search");
	const emptyState = document.querySelector("#empty-state");
	const filterButtons = [...document.querySelectorAll("[data-filter]")];
	const shareDialog = document.querySelector("#share-dialog");
	const shareForm = document.querySelector("#share-form");
	let activeFilter = "all";
	let toastTimer;

	function readState() {
		try {
			return JSON.parse(localStorage.getItem(storageKey)) || {};
		} catch {
			return {};
		}
	}

	const state = {
		joined: new Set(readState().joined || []),
		saved: new Set(readState().saved || []),
		shared: Array.isArray(readState().shared) ? readState().shared : [],
		featuredJoined: Boolean(readState().featuredJoined)
	};

	function persist() {
		try {
			localStorage.setItem(storageKey, JSON.stringify({
				joined: [...state.joined],
				saved: [...state.saved],
				shared: state.shared,
				featuredJoined: state.featuredJoined
			}));
		} catch {
			showToast("Your browser could not save this change.");
		}
	}

	function escapeHtml(value) {
		return String(value).replace(/[&<>"']/g, (character) => ({
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&#39;"
		})[character]);
	}

	function dateParts(dateString) {
		const date = new Date(`${dateString}T12:00:00`);
		return {
			day: new Intl.DateTimeFormat("en", { day: "2-digit" }).format(date),
			month: new Intl.DateTimeFormat("en", { month: "short" }).format(date).toUpperCase(),
			full: new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(date)
		};
	}

	function allActivities() {
		return [...state.shared, ...activities];
	}

	function renderActivity(activity, index) {
		const date = dateParts(activity.date);
		const joined = state.joined.has(activity.id);
		const saved = state.saved.has(activity.id);
		const category = categoryLabels[activity.category] || categoryLabels.care;
		return `<article class="activity-card" style="animation-delay:${Math.min(index * 45, 180)}ms">
			<div class="activity-card-top">
				<span class="activity-date"><small>${date.month}</small><strong>${date.day}</strong></span>
				<button class="activity-bookmark${saved ? " saved" : ""}" type="button" data-save="${escapeHtml(activity.id)}" aria-label="${saved ? "Remove saved activity" : "Save activity"}" aria-pressed="${saved}"><i data-lucide="bookmark"></i></button>
			</div>
			<div class="activity-body">
				<span class="category-label"><span class="category-dot ${escapeHtml(activity.category)}"></span>${category}</span>
				<h3>${escapeHtml(activity.title)}</h3>
				<p>${escapeHtml(activity.description)}</p>
				<div class="activity-meta"><span><i data-lucide="clock-3"></i>${date.full} · ${escapeHtml(activity.time)}</span><span><i data-lucide="map-pin"></i>${escapeHtml(activity.location)}</span></div>
				<div class="activity-card-footer"><span class="activity-attendees">${Number(activity.attendees) + (joined ? 1 : 0)} people going</span><button class="button activity-join${joined ? " joined" : ""}" type="button" data-join="${escapeHtml(activity.id)}" aria-pressed="${joined}">${joined ? "You're going" : "Join activity"}</button></div>
			</div>
		</article>`;
	}

	function refreshIcons() {
		if (window.lucide) window.lucide.createIcons();
	}

	function render() {
		const query = search.value.trim().toLowerCase();
		const visible = allActivities().filter((activity) => {
			const matchesCategory = activeFilter === "all" || activity.category === activeFilter;
			const searchable = `${activity.title} ${activity.location} ${activity.description}`.toLowerCase();
			return matchesCategory && searchable.includes(query);
		});

		list.innerHTML = visible.map(renderActivity).join("");
		emptyState.hidden = visible.length > 0;
		document.querySelector("#activity-count").textContent = allActivities().length;
		document.querySelector("#all-count").textContent = allActivities().length;
		refreshIcons();
	}

	function updateImpact() {
		const joinedActivities = allActivities().filter((activity) => state.joined.has(activity.id));
		const hours = 12.5 + joinedActivities.reduce((total, activity) => total + Number(activity.duration || 2), 0);
		const joinedCount = 4 + joinedActivities.length + (state.featuredJoined ? 1 : 0);
		const cappedHours = Math.min(hours, 16);
		document.querySelector("#hours-stat").textContent = Number.isInteger(hours) ? hours : hours.toFixed(1);
		document.querySelector("#joined-stat").textContent = joinedCount;
		document.querySelector("#progress-hours").textContent = Number.isInteger(hours) ? hours : hours.toFixed(1);
		document.querySelector("#progress-fill").style.width = `${Math.min((hours / 16) * 100, 100)}%`;
		const remaining = Math.max(16 - hours, 0);
		document.querySelector("#progress-message").textContent = remaining ? `${Number.isInteger(remaining) ? remaining : remaining.toFixed(1)} hours to your monthly goal` : "Monthly goal reached. What a difference!";
		const featuredButton = document.querySelector('[data-join="featured"]');
		featuredButton.innerHTML = state.featuredJoined ? 'You\'re going <i data-lucide="check"></i>' : 'Count me in <i data-lucide="arrow-up-right"></i>';
		featuredButton.classList.toggle("joined", state.featuredJoined);
		featuredButton.setAttribute("aria-pressed", String(state.featuredJoined));
		document.querySelector(".attendee-label").textContent = state.featuredJoined ? "you + 18 going" : "are going";
		refreshIcons();
	}

	function showToast(message) {
		const toast = document.querySelector("#toast");
		toast.textContent = message;
		toast.classList.add("visible");
		window.clearTimeout(toastTimer);
		toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2600);
	}

	filterButtons.forEach((button) => {
		button.addEventListener("click", () => {
			activeFilter = button.dataset.filter;
			filterButtons.forEach((tab) => {
				const selected = tab === button;
				tab.classList.toggle("selected", selected);
				tab.setAttribute("aria-pressed", String(selected));
			});
			render();
		});
	});

	search.addEventListener("input", render);

	list.addEventListener("click", (event) => {
		const joinButton = event.target.closest("[data-join]");
		const saveButton = event.target.closest("[data-save]");

		if (joinButton) {
			const id = joinButton.dataset.join;
			if (state.joined.has(id)) {
				state.joined.delete(id);
				showToast("You left this activity.");
			} else {
				state.joined.add(id);
				showToast("You're on the list. See you there!");
			}
			persist();
			render();
			updateImpact();
		}

		if (saveButton) {
			const id = saveButton.dataset.save;
			if (state.saved.has(id)) state.saved.delete(id);
			else state.saved.add(id);
			persist();
			render();
			showToast(state.saved.has(id) ? "Activity saved." : "Activity removed from saved.");
		}
	});

	document.querySelector('[data-join="featured"]').addEventListener("click", () => {
		state.featuredJoined = !state.featuredJoined;
		persist();
		updateImpact();
		showToast(state.featuredJoined ? "You're on the list. See you Saturday!" : "You left this activity.");
	});

	document.querySelector("#share-activity").addEventListener("click", () => shareDialog.showModal());
	document.querySelector("#close-dialog").addEventListener("click", () => shareDialog.close());
	document.querySelector("#cancel-dialog").addEventListener("click", () => shareDialog.close());

	shareForm.addEventListener("submit", (event) => {
		event.preventDefault();
		const formData = new FormData(shareForm);
		const title = String(formData.get("title")).trim();
		const location = String(formData.get("location")).trim();
		if (!title || !location) return;

		state.shared.unshift({
			id: `shared-${Date.now()}`,
			title,
			category: String(formData.get("category")),
			date: String(formData.get("date")),
			time: "9:00 AM",
			location,
			district: "Kigali",
			description: String(formData.get("description")).trim() || "Join your neighbors and make a difference together.",
			attendees: 1,
			duration: 2
		});
		persist();
		shareForm.reset();
		shareDialog.close();
		activeFilter = "all";
		filterButtons.forEach((tab) => {
			const selected = tab.dataset.filter === "all";
			tab.classList.toggle("selected", selected);
			tab.setAttribute("aria-pressed", String(selected));
		});
		search.value = "";
		render();
		updateImpact();
		showToast("Your activity is now on the community board.");
	});

	shareDialog.addEventListener("click", (event) => {
		if (event.target === shareDialog) shareDialog.close();
	});

	const dateInput = shareForm.querySelector('[name="date"]');
	dateInput.min = new Date().toLocaleDateString("en-CA");
	render();
	updateImpact();
})();
