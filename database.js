window.SMART_UMUGANDA_ACTIVITIES = [
	{
		id: "market-cleanup",
		title: "A cleaner Kimironko market",
		category: "clean",
		date: "2026-10-10",
		time: "8:00 AM",
		location: "Kimironko Market",
		district: "Gasabo",
		description: "Help vendors and neighbors clear litter and sort recyclables around the market.",
		attendees: 24,
		duration: 2
	},
	{
		id: "reading-circle",
		title: "Saturday reading circle",
		category: "learn",
		date: "2026-10-11",
		time: "10:00 AM",
		location: "Remera Community Library",
		district: "Gasabo",
		description: "Share stories and reading practice with children from the neighborhood.",
		attendees: 12,
		duration: 2.5
	},
	{
		id: "garden-nyarutarama",
		title: "Plant a neighborhood garden",
		category: "clean",
		date: "2026-10-17",
		time: "8:30 AM",
		location: "Nyarutarama Community Garden",
		district: "Gasabo",
		description: "Prepare garden beds and plant native flowers and herbs with local families.",
		attendees: 16,
		duration: 3
	},
	{
		id: "elder-visits",
		title: "A morning with our elders",
		category: "care",
		date: "2026-10-18",
		time: "9:00 AM",
		location: "Kacyiru Sector Office",
		district: "Gasabo",
		description: "Spend time together, lend a hand with errands, and share a cup of tea.",
		attendees: 9,
		duration: 2
	},
	{
		id: "digital-skills",
		title: "Digital skills for everyone",
		category: "learn",
		date: "2026-10-24",
		time: "9:00 AM",
		location: "Gisozi Youth Center",
		district: "Gasabo",
		description: "Help community members get comfortable using a smartphone and online services.",
		attendees: 14,
		duration: 3
	},
	{
		id: "safe-walkways",
		title: "Safer paths to school",
		category: "care",
		date: "2026-10-25",
		time: "8:00 AM",
		location: "Kibagabaga Primary School",
		district: "Gasabo",
		description: "Walk the school routes together and note small fixes that can make them safer.",
		attendees: 18,
		duration: 2
	}
];

window.SMART_UMUGANDA_SEED = {
	activities: [
		{ id: "activity-1", name: "Isuku rusange mu mudugudu", location: "Remera, Gasabo", date: "2026-10-24", time: "08:00", description: "Gusukura umuhanda no gutunganya inzira z'amazi.", status: "Planned", participants: 86, workDone: "", evidence: [] },
		{ id: "activity-2", name: "Gutera ibiti ku ishuri", location: "Kimironko, Gasabo", date: "2026-10-31", time: "08:30", description: "Gutera ibiti no kubungabunga aho abana bigira.", status: "Planned", participants: 42, workDone: "", evidence: [] },
		{ id: "activity-3", name: "Gufasha abatishoboye", location: "Kacyiru, Gasabo", date: "2026-10-03", time: "09:00", description: "Gusana no gufasha imiryango ikeneye ubufasha.", status: "Completed", participants: 124, workDone: "Inzu 4 zarasanwe, imiryango 12 yahawe ubufasha.", evidence: [] }
	],
	tasks: [
		{ id: "task-1", title: "Gutegura ibikoresho by'isuku", location: "Remera", due: "2026-10-22", status: "Open", assigned: "Abakorerabushake" },
		{ id: "task-2", title: "Kumenyesha abaturage gahunda", location: "Kimironko", due: "2026-10-23", status: "In progress", assigned: "Umuyobozi w'umudugudu" },
		{ id: "task-3", title: "Gukusanya ibikoresho byo gutera", location: "Kacyiru", due: "2026-10-29", status: "Open", assigned: "Itsinda ry'urubyiruko" }
	],
	translations: {
		en: {
			navDashboard: "Home / Dashboard", navRegister: "Citizen registration", navActivities: "Umuganda activities", navParticipation: "Participation & check-in", navTasks: "Community tasks", navReports: "Reports & evidence", navLeaders: "Leader dashboard", navNational: "Head admin / Minister", language: "Language", switchRole: "Leader access"
		},
		rw: {
			navDashboard: "Ahabanza / Incamake", navRegister: "Kwiyandikisha kw'abaturage", navActivities: "Ibikorwa by'Umuganda", navParticipation: "Kwitabira no kwiyandikisha", navTasks: "Imirimo y'abaturage", navReports: "Raporo n'ibimenyetso", navLeaders: "Incamake y'abayobozi", navNational: "Ubuyobozi bukuru / Minisitiri", language: "Ururimi", switchRole: "Kwinjira k'umuyobozi"
		}
	}
};
