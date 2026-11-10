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
    id: "step1",
    tag: "Speed Test",
    text: "Spent 3 hours on the Acme design review yesterday and 1 hour on internal standup."
  },
  {
    id: "step2",
    tag: "Ambiguity Test",
    text: "2 hours on Acme development."
  },
  {
    id: "step3",
    tag: "Closed Project Test",
    text: "4 hours on Initech fieldwork today, billable."
  }
];
