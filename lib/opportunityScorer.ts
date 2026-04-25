/**
 * opportunityScorer.ts - Score job opportunities against business profile
 * Determines which leads are best matches
 */

import { JobOpportunity } from "./jobBoardConnector";
import { UserMemoryProfile } from "./userMemoryProfile";

export interface ScoredOpportunity extends JobOpportunity {
  score: number; // 0-100
  reasoning: string;
  scoreBreakdown: {
    titleMatch: number;
    industryMatch: number;
    locationMatch: number;
    salaryMatch: number;
    skillsMatch: number;
    urgency: number;
  };
  recommendation: "hot" | "warm" | "cold" | "skip";
}

class OpportunityScorerClass {
  private static instance: OpportunityScorerClass;

  private constructor() {}

  static getInstance(): OpportunityScorerClass {
    if (!OpportunityScorerClass.instance) {
      OpportunityScorerClass.instance = new OpportunityScorerClass();
    }
    return OpportunityScorerClass.instance;
  }

  /**
   * Score a single opportunity against profile
   */
  scoreOpportunity(
    opportunity: JobOpportunity,
    userProfile: UserMemoryProfile
  ): ScoredOpportunity {
    const breakdown = {
      titleMatch: this.scoreTitleMatch(opportunity, userProfile),
      industryMatch: this.scoreIndustryMatch(opportunity, userProfile),
      locationMatch: this.scoreLocationMatch(opportunity, userProfile),
      salaryMatch: this.scoreSalaryMatch(opportunity, userProfile),
      skillsMatch: this.scoreSkillsMatch(opportunity, userProfile),
      urgency: this.scoreUrgency(opportunity),
    };

    // Weighted average
    const score = Math.round(
      breakdown.titleMatch * 0.25 +
        breakdown.industryMatch * 0.15 +
        breakdown.locationMatch * 0.15 +
        breakdown.salaryMatch * 0.2 +
        breakdown.skillsMatch * 0.15 +
        breakdown.urgency * 0.1
    );

    const recommendation = this.getRecommendation(score);
    const reasoning = this.generateReasoning(opportunity, breakdown, score);

    return {
      ...opportunity,
      score,
      reasoning,
      scoreBreakdown: breakdown,
      recommendation,
    };
  }

  /**
   * Score title match (0-100)
   */
  private scoreTitleMatch(
    opportunity: JobOpportunity,
    userProfile: UserMemoryProfile
  ): number {
    const jobTitle = opportunity.title.toLowerCase();
    const businessType = (userProfile.businessType || "").toLowerCase();

    // Check for industry-specific keywords
    const industryKeywords = [
      "contractor",
      "plumber",
      "electrician",
      "hvac",
      "builder",
      "carpenter",
      "lawyer",
      "accountant",
      "designer",
      "developer",
    ];

    let score = 50; // Base score

    // Exact industry match
    if (industryKeywords.some((kw) => jobTitle.includes(kw) && businessType.includes(kw))) {
      score = 90;
    }
    // Partial match
    else if (industryKeywords.some((kw) => businessType.includes(kw) && jobTitle.includes(kw.slice(0, 3)))) {
      score = 70;
    }
    // Senior/Lead roles get bonus
    else if (jobTitle.includes("senior") || jobTitle.includes("lead")) {
      score += 15;
    }

    return Math.min(100, score);
  }

  /**
   * Score industry match (0-100)
   */
  private scoreIndustryMatch(
    opportunity: JobOpportunity,
    userProfile: UserMemoryProfile
  ): number {
    const jobDescription = opportunity.description.toLowerCase();
    const businessInfo = (userProfile.businessInformation || "").toLowerCase();

    // Count matching keywords
    const businessWords = businessInfo.split(" ").filter((w) => w.length > 4);
    let matchCount = 0;

    for (const word of businessWords) {
      if (jobDescription.includes(word)) {
        matchCount++;
      }
    }

    return Math.min(100, matchCount * 15);
  }

  /**
   * Score location match (0-100)
   */
  private scoreLocationMatch(
    opportunity: JobOpportunity,
    userProfile: UserMemoryProfile
  ): number {
    const jobLocation = opportunity.location.toLowerCase();
    const userLocation = (userProfile.businessLocation || "").toLowerCase();

    // Exact location match
    if (jobLocation.includes(userLocation) || userLocation.includes(jobLocation)) {
      return 100;
    }

    // Same state/region
    if (
      jobLocation.split(",")[1]?.trim() === userLocation.split(",")[1]?.trim()
    ) {
      return 70;
    }

    // Remote friendly
    if (jobLocation.includes("remote") || jobLocation.includes("anywhere")) {
      return 80;
    }

    return 30; // Different location
  }

  /**
   * Score salary match (0-100)
   */
  private scoreSalaryMatch(
    opportunity: JobOpportunity,
    userProfile: UserMemoryProfile
  ): number {
    if (!opportunity.salary) return 50;

    // Assume business wants to maximize revenue
    // Higher salaries = better funded companies
    const { min, max } = opportunity.salary;
    const midpoint = (min + max) / 2;

    // Preferred range: $100k-$500k for B2B
    if (midpoint >= 100000 && midpoint <= 500000) {
      return 90;
    }
    if (midpoint >= 80000 && midpoint <= 600000) {
      return 75;
    }
    if (midpoint >= 50000) {
      return 60;
    }

    return 40;
  }

  /**
   * Score skills match (0-100)
   */
  private scoreSkillsMatch(
    opportunity: JobOpportunity,
    userProfile: UserMemoryProfile
  ): number {
    const userSkills = (userProfile.keySkills || "").toLowerCase().split(",");
    const jobRequirements = opportunity.requirements.map((r) => r.toLowerCase());

    let matchCount = 0;

    for (const skill of userSkills) {
      if (
        jobRequirements.some((req) =>
          req.includes(skill.trim())
        )
      ) {
        matchCount++;
      }
    }

    return Math.min(100, matchCount * 20);
  }

  /**
   * Score urgency (0-100) - newer jobs are higher urgency
   */
  private scoreUrgency(opportunity: JobOpportunity): number {
    const daysOld =
      (Date.now() - opportunity.postedDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysOld < 1) return 100; // Posted today
    if (daysOld < 3) return 85; // Posted recently
    if (daysOld < 7) return 70; // Posted this week
    if (daysOld < 14) return 55; // Posted last week
    if (daysOld < 30) return 40; // Posted this month

    return 20; // Older posting
  }

  /**
   * Get recommendation based on score
   */
  private getRecommendation(
    score: number
  ): "hot" | "warm" | "cold" | "skip" {
    if (score >= 80) return "hot"; // Reach out immediately
    if (score >= 60) return "warm"; // Good fit, follow up
    if (score >= 40) return "cold"; // Possible fit
    return "skip"; // Not a good match
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    opportunity: JobOpportunity,
    breakdown: Record<string, number>,
    score: number
  ): string {
    const factors: string[] = [];

    if (breakdown.titleMatch > 70) {
      factors.push("Strong title match");
    }
    if (breakdown.locationMatch > 70) {
      factors.push("Location alignment");
    }
    if (breakdown.salaryMatch > 70) {
      factors.push("Attractive budget");
    }
    if (breakdown.skillsMatch > 70) {
      factors.push("Skills aligned");
    }
    if (breakdown.urgency > 70) {
      factors.push("Recently posted");
    }

    if (factors.length === 0) {
      factors.push("Some overlap with profile");
    }

    return factors.join(" • ");
  }

  /**
   * Score multiple opportunities and sort by score
   */
  scoreOpportunities(
    opportunities: JobOpportunity[],
    userProfile: UserMemoryProfile
  ): ScoredOpportunity[] {
    return opportunities
      .map((opp) => this.scoreOpportunity(opp, userProfile))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Filter opportunities by recommendation
   */
  filterByRecommendation(
    opportunities: ScoredOpportunity[],
    minRecommendation: "hot" | "warm" | "cold" | "skip" = "warm"
  ): ScoredOpportunity[] {
    const recommendationOrder = { hot: 3, warm: 2, cold: 1, skip: 0 };
    return opportunities.filter(
      (opp) =>
        recommendationOrder[opp.recommendation] >=
        recommendationOrder[minRecommendation]
    );
  }
}

export const opportunityScorer = OpportunityScorerClass.getInstance();
