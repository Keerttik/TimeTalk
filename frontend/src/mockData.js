export const MOCK_CATALOGUE = {
  company: "Northwind Consulting",
  currency: "INR",
  symbol: "₹",
  projects: [
    {
      code: "ACME-WEB",
      name: "Acme Website Redesign",
      client: "Acme Corp",
      type: "billable",
      is_billable: true,
      bill_rate: 4000,
      budget_hours: 200,
      hours_logged: 176,
      budget_used_pct: 88,
      tasks: ["Design", "Development", "QA"],
      status: "active"
    },
    {
      code: "ACME-MOB",
      name: "Acme Mobile App",
      client: "Acme Corp",
      type: "billable",
      is_billable: true,
      bill_rate: 4000,
      budget_hours: 150,
      hours_logged: 60,
      budget_used_pct: 40,
      tasks: ["Design", "Development"],
      status: "active"
    },
    {
      code: "GLOBEX-DATA",
      name: "Globex Data Migration",
      client: "Globex Corp",
      type: "billable",
      is_billable: true,
      bill_rate: 3500,
      budget_hours: 300,
      hours_logged: 195,
      budget_used_pct: 65,
      tasks: ["Analysis", "Migration"],
      status: "active"
    },
    {
      code: "INITECH-AUD",
      name: "Initech Audit Support",
      client: "Initech Inc",
      type: "billable",
      is_billable: true,
      bill_rate: 3000,
      budget_hours: 100,
      hours_logged: 100,
      budget_used_pct: 100,
      tasks: ["Fieldwork"],
      status: "closed",
      end_date: "2026-10-31"
    },
    {
      code: "INT-OPS",
      name: "Internal Operations",
      client: "Northwind Internal",
      type: "non_billable",
      is_billable: false,
      bill_rate: 0,
      budget_hours: null,
      hours_logged: 320,
      budget_used_pct: null,
      tasks: ["Standup", "Training", "Admin"],
      status: "active"
    }
  ]
};

export const QUICK_PROMPTS = [
  {
    id: "log_yesterday",
    label: "Log yesterday",
    text: "Spent 3 hours on the Acme design review yesterday and 1 hour on internal standup."
  },
  {
    id: "ambiguous_project",
    label: "Ambiguous project",
    text: "2 hours on Acme development."
  },
  {
    id: "closed_project",
    label: "Closed project",
    text: "4 hours on Initech fieldwork today, billable."
  },
  {
    id: "catch_up_last_week",
    label: "Catch up last week",
    action: "start_reconstruction",
    text: "Catch up last week"
  }
];

// 6 peer consultants seeded with a full Mon-Fri week of entries (plus Priya live = 7 total)
export const TEAM_CONSULTANTS_SEED = [
  {
    id: "u_arjun",
    name: "Arjun Mehta",
    role: "Principal Consultant",
    entries: [
      { date: "2026-11-09", project_code: "ACME-WEB", hours: 6.5, is_billable: true, user_edited: false, days_late: 0 },
      { date: "2026-11-09", project_code: "INT-OPS", hours: 1.0, is_billable: false, user_edited: false, days_late: 0 },
      { date: "2026-11-10", project_code: "ACME-WEB", hours: 8.5, is_billable: true, user_edited: true, days_late: 0 },
      { date: "2026-11-11", project_code: "GLOBEX-DATA", hours: 9.0, is_billable: true, user_edited: false, days_late: 0 },
      { date: "2026-11-12", project_code: "ACME-MOB", hours: 7.0, is_billable: true, user_edited: false, days_late: 1 },
      { date: "2026-11-13", project_code: "ACME-WEB", hours: 6.0, is_billable: true, user_edited: false, days_late: 0 },
      { date: "2026-11-13", project_code: "INT-OPS", hours: 2.0, is_billable: false, user_edited: false, days_late: 0 }
    ]
  },
  {
    id: "u_rohan",
    name: "Rohan Kulkarni",
    role: "Senior Consultant",
    entries: [
      { date: "2026-11-09", project_code: "GLOBEX-DATA", hours: 8.0, is_billable: true, user_edited: false, days_late: 6 },
      { date: "2026-11-10", project_code: "GLOBEX-DATA", hours: 8.0, is_billable: true, user_edited: false, days_late: 6 },
      { date: "2026-11-11", project_code: "GLOBEX-DATA", hours: 8.0, is_billable: true, user_edited: false, days_late: 6 },
      { date: "2026-11-12", project_code: "GLOBEX-DATA", hours: 8.0, is_billable: true, user_edited: false, days_late: 6 },
      { date: "2026-11-13", project_code: "GLOBEX-DATA", hours: 8.0, is_billable: true, user_edited: false, days_late: 6 }
    ]
  },
  {
    id: "u_ananya",
    name: "Ananya Iyer",
    role: "Consultant",
    entries: [
      { date: "2026-11-09", project_code: "ACME-MOB", hours: 6.5, is_billable: true, user_edited: false, days_late: 0 },
      { date: "2026-11-10", project_code: "ACME-MOB", hours: 7.5, is_billable: true, user_edited: true, days_late: 0 },
      { date: "2026-11-10", project_code: "INT-OPS", hours: 1.5, is_billable: false, user_edited: false, days_late: 0 },
      { date: "2026-11-11", project_code: "ACME-WEB", hours: 8.0, is_billable: true, user_edited: false, days_late: 1 },
      { date: "2026-11-12", project_code: "ACME-MOB", hours: 7.5, is_billable: true, user_edited: false, days_late: 0 },
      { date: "2026-11-13", project_code: "INT-OPS", hours: 6.0, is_billable: false, user_edited: false, days_late: 0 }
    ]
  },
  {
    id: "u_vikram",
    name: "Vikram Nair",
    role: "Delivery Lead",
    override_count: 1,
    entries: [
      { date: "2026-11-09", project_code: "ACME-WEB", hours: 8.0, is_billable: true, user_edited: false, days_late: 7 },
      { date: "2026-11-10", project_code: "ACME-WEB", hours: 8.0, is_billable: true, user_edited: false, days_late: 7 },
      { date: "2026-11-11", project_code: "ACME-WEB", hours: 8.0, is_billable: true, user_edited: false, days_late: 7 },
      { date: "2026-11-12", project_code: "ACME-WEB", hours: 8.0, is_billable: true, user_edited: false, days_late: 7 },
      { date: "2026-11-13", project_code: "ACME-WEB", hours: 6.0, is_billable: true, user_edited: true, days_late: 7 },
      { date: "2026-11-13", project_code: "INT-OPS", hours: 2.0, is_billable: false, user_edited: false, days_late: 7 }
    ]
  },
  {
    id: "u_meera",
    name: "Meera Deshmukh",
    role: "Associate Consultant",
    entries: [
      { date: "2026-11-09", project_code: "GLOBEX-DATA", hours: 7.0, is_billable: true, user_edited: false, days_late: 0 },
      { date: "2026-11-10", project_code: "GLOBEX-DATA", hours: 6.5, is_billable: true, user_edited: false, days_late: 0 },
      { date: "2026-11-10", project_code: "INT-OPS", hours: 1.5, is_billable: false, user_edited: false, days_late: 0 },
      { date: "2026-11-11", project_code: "ACME-MOB", hours: 8.5, is_billable: true, user_edited: true, days_late: 0 },
      { date: "2026-11-12", project_code: "GLOBEX-DATA", hours: 8.0, is_billable: true, user_edited: false, days_late: 1 },
      { date: "2026-11-13", project_code: "ACME-MOB", hours: 5.5, is_billable: true, user_edited: false, days_late: 0 },
      { date: "2026-11-13", project_code: "INT-OPS", hours: 2.0, is_billable: false, user_edited: false, days_late: 0 }
    ]
  },
  {
    id: "u_kabir",
    name: "Kabir Verma",
    role: "Consultant",
    entries: [
      { date: "2026-11-09", project_code: "ACME-MOB", hours: 8.0, is_billable: true, user_edited: false, days_late: 0 },
      { date: "2026-11-10", project_code: "ACME-MOB", hours: 8.0, is_billable: true, user_edited: false, days_late: 0 },
      { date: "2026-11-11", project_code: "ACME-MOB", hours: 8.0, is_billable: true, user_edited: false, days_late: 0 },
      { date: "2026-11-12", project_code: "ACME-MOB", hours: 8.0, is_billable: true, user_edited: false, days_late: 1 },
      { date: "2026-11-13", project_code: "ACME-MOB", hours: 8.0, is_billable: true, user_edited: false, days_late: 0 }
    ]
  }
];

