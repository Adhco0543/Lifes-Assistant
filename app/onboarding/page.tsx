import Link from "next/link";
import { OnboardingForm } from "@/components/OnboardingForm";

export default function OnboardingPage() {
  return (
    <main className="page">
      <div className="stack">
        <Link className="back" href="/">
          ← Home
        </Link>
        <OnboardingForm />
      </div>
    </main>
  );
}
