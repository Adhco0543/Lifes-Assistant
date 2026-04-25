export type Industry =
  | ""
  | "carpentry"
  | "salon"
  | "auto_repair"
  | "restaurant"
  | "retail"
  | "other";

export type TeamSize = "solo" | "2_5" | "6_15" | "16_plus";
export type RevenueModel =
  | "appointments"
  | "projects"
  | "products"
  | "subscription"
  | "mixed";
export type WorkMode = "on_site" | "client_site" | "hybrid";

export type OnboardingData = {
  businessName: string;
  industry: Industry;
  teamSize: TeamSize;
  revenueModel: RevenueModel;
  workMode: WorkMode;
  painPoints: string[];
  timeSavingFocus: string;
  tools: string[];
  roleAnswers: Record<string, string>;
};

export const defaultOnboardingData: OnboardingData = {
  businessName: "",
  industry: "",
  teamSize: "solo",
  revenueModel: "projects",
  workMode: "hybrid",
  painPoints: [],
  timeSavingFocus: "",
  tools: [],
  roleAnswers: {},
};

export const PAIN_POINTS = [
  "scheduling",
  "quotes",
  "invoicing",
  "client_communication",
  "team_coordination",
  "inventory",
  "followups",
  "reporting",
] as const;

export const TOOLS = [
  "google_calendar",
  "quickbooks",
  "stripe",
  "square",
  "sheets",
  "none",
] as const;

export const industrySpecificQuestions: Record<
  Exclude<Industry, "">,
  { key: string; label: string; options: string[] }[]
> = {
  carpentry: [
    { key: "estimates", label: "Do you create estimates before jobs?", options: ["yes", "no"] },
    {
      key: "material_changes",
      label: "How often do material costs change?",
      options: ["rarely", "sometimes", "often"],
    },
    { key: "job_stages", label: "Do your jobs happen in stages?", options: ["yes", "no"] },
  ],
  salon: [
    { key: "appointments", label: "Do you rely on appointments?", options: ["yes", "no"] },
    { key: "no_show_reminders", label: "Do you need no-show reminders?", options: ["yes", "no"] },
    { key: "product_sales", label: "Do you sell add-on products?", options: ["yes", "no"] },
  ],
  auto_repair: [],
  restaurant: [],
  retail: [],
  other: [],
};