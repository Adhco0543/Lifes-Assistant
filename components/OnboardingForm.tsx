"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  defaultOnboardingData,
  industrySpecificQuestions,
  Industry,
  OnboardingData,
  PAIN_POINTS,
  TOOLS,
} from "@/lib/onboarding";
import AutonomySettingsForm from "./AutonomySettingsForm";

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const STEPS: { title: string; description: string }[] = [
  { title: "Business basics", description: "Tell us what kind of business you run." },
  { title: "How you work", description: "Help us understand your daily operations." },
  { title: "Pain points", description: "Pick your biggest workflow bottlenecks." },
  { title: "Tools", description: "Select the tools you currently use." },
  { title: "Role-specific", description: "A few tailored questions for your industry." },
  { title: "Assistant autonomy", description: "Control what the AI can do automatically." },
  { title: "Review setup", description: "Confirm and finish onboarding." },
];

export function OnboardingForm() {
  const [step, setStep] = useState<Step>(0);
  const [data, setData] = useState<OnboardingData>(defaultOnboardingData);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const roleQuestions = useMemo(() => {
    if (!data.industry) return [];
    const industry = data.industry as Exclude<typeof data.industry, "">;
    return industrySpecificQuestions[industry];
  }, [data.industry]);

  const updateField = <K extends keyof OnboardingData>(
    key: K,
    value: OnboardingData[K]
  ) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setError("");
  };

  const toggleInList = (field: "painPoints" | "tools", value: string) => {
    setData((prev) => {
      const hasValue = prev[field].includes(value);
      const next = hasValue
        ? prev[field].filter((item) => item !== value)
        : [...prev[field], value];
      return { ...prev, [field]: next };
    });
    setError("");
  };

  const validateStep = () => {
    if (step === 0) {
      if (!data.businessName.trim()) return "Enter your business name.";
      if (!data.industry) return "Select your industry.";
    }

    if (step === 2) {
      if (data.painPoints.length === 0) return "Pick at least 1 pain point.";
      if (!data.timeSavingFocus.trim()) return "Tell us what would save you the most time.";
    }

    if (step === 4 && roleQuestions.length > 0) {
      const missingQuestion = roleQuestions.find(
        (question: { key: string; label: string; options: string[] }) =>
          !data.roleAnswers?.[question.key]
      );
      if (missingQuestion) return `Please answer: ${missingQuestion.label}`;
    }

    return "";
  };

  const nextStep = () => {
    const errorMessage = validateStep();
    if (errorMessage) {
      setError(errorMessage);
      return;
    }

    setError("");
    setStep((prev) => Math.min(prev + 1, 5) as Step);
  };

  const previousStep = () => setStep((prev) => Math.max(prev - 1, 0) as Step);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    localStorage.setItem("onboarding_profile", JSON.stringify(data));
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="card">
        <h2>Setup complete</h2>
        <p>
          Your answers were saved locally as <code>onboarding_profile</code>. Next step: send this
          object to your backend <code>/setup/generate</code> endpoint.
        </p>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
    );
  }

  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <form className="card" onSubmit={handleSubmit}>
      <p className="eyebrow">
        Step {step + 1} of {STEPS.length}
      </p>
      <h2>{STEPS[step].title}</h2>
      <p>{STEPS[step].description}</p>

      <div className="progress">
        <div style={{ width: `${progress}%` }} />
      </div>

      {error ? <p style={{ color: "#b91c1c", fontWeight: 600 }}>{error}</p> : null}

      {step === 0 && (
        <section className="fields">
          <label>
            Business name
            <input
              id="businessName"
              name="businessName"
              required
              value={data.businessName}
              onChange={(e) => updateField("businessName", e.target.value)}
            />
          </label>

          <label>
            Industry
            <select
              id="industry"
              name="industry"
              value={data.industry}
              onChange={(e) => updateField("industry", e.target.value as Industry)}
              required
            >
              <option value="">Select industry</option>
              <option value="carpentry">Carpentry</option>
              <option value="salon">Salon</option>
              <option value="auto_repair">Auto Repair</option>
              <option value="restaurant">Restaurant</option>
              <option value="retail">Retail</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label>
            Team size
            <select
              id="teamSize"
              name="teamSize"
              value={data.teamSize}
              onChange={(e) =>
                updateField("teamSize", e.target.value as OnboardingData["teamSize"])
              }
            >
              <option value="solo">Just me</option>
              <option value="2_5">2-5</option>
              <option value="6_15">6-15</option>
              <option value="16_plus">16+</option>
            </select>
          </label>
        </section>
      )}

      {step === 1 && (
        <section className="fields">
          <label>
            Revenue model
            <select
              id="revenueModel"
              name="revenueModel"
              value={data.revenueModel}
              onChange={(e) =>
                updateField("revenueModel", e.target.value as OnboardingData["revenueModel"])
              }
            >
              <option value="appointments">Appointments</option>
              <option value="projects">Projects/jobs</option>
              <option value="products">Product sales</option>
              <option value="subscription">Subscription</option>
              <option value="mixed">Mixed</option>
            </select>
          </label>

          <label>
            Work mode
            <select
              id="workMode"
              name="workMode"
              value={data.workMode}
              onChange={(e) =>
                updateField("workMode", e.target.value as OnboardingData["workMode"])
              }
            >
              <option value="on_site">At a location/shop</option>
              <option value="client_site">At client sites</option>
              <option value="hybrid">Both</option>
            </select>
          </label>
        </section>
      )}

      {step === 2 && (
        <section className="chips">
          {PAIN_POINTS.map((painPoint) => (
            <button
              type="button"
              className={data.painPoints.includes(painPoint) ? "chip active" : "chip"}
              key={painPoint}
              onClick={() => toggleInList("painPoints", painPoint)}
            >
              {painPoint.replaceAll("_", " ")}
            </button>
          ))}

          <label>
            What would save you the most time each week?
            <textarea
              id="timeSavingFocus"
              name="timeSavingFocus"
              value={data.timeSavingFocus}
              onChange={(e) => updateField("timeSavingFocus", e.target.value)}
              placeholder="Example: Faster quote approvals and automatic invoice reminders"
            />
          </label>
        </section>
      )}

      {step === 3 && (
        <section className="chips">
          {TOOLS.map((tool) => (
            <button
              type="button"
              className={data.tools.includes(tool) ? "chip active" : "chip"}
              key={tool}
              onClick={() => toggleInList("tools", tool)}
            >
              {tool.replaceAll("_", " ")}
            </button>
          ))}
        </section>
      )}

      {step === 4 && (
        <section className="fields">
          {roleQuestions.length === 0 ? (
            <p>No additional questions for this industry yet.</p>
          ) : (
            roleQuestions.map((question: { key: string; label: string; options: string[] }) => (
              <label key={question.key}>
                {question.label}
                <select
                  id={`role-${question.key}`}
                  name={`role-${question.key}`}
                  value={data.roleAnswers[question.key] ?? ""}
                  onChange={(e) =>
                    updateField("roleAnswers", {
                      ...data.roleAnswers,
                      [question.key]: e.target.value,
                    })
                  }
                >
                  <option value="">Select one</option>
                  {question.options.map((option: string) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ))
          )}
        </section>
      )}

      {step === 5 && (
        <section className="fields">
          <p>Configure how much the assistant can do automatically.</p>
          <AutonomySettingsForm userId={"onboarding"} />
        </section>
      )}

      {step === 6 && (
        <section className="fields">
          <p>Review your onboarding profile before completing setup.</p>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </section>
      )}

      <div className="actions">
        <button
          type="button"
          className="button ghost"
          disabled={step === 0}
          onClick={previousStep}
        >
          Back
        </button>

        {step < 6 ? (
          <button type="button" className="button" onClick={nextStep}>
            Continue
          </button>
        ) : (
          <button type="submit" className="button">
            Complete setup
          </button>
        )}
      </div>
    </form>
  );
}