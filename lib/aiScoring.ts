/**
 * AI Powered Recommendation Scoring
 * Scores and ranks recommendations based on user behavior and preferences
 */

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  relevanceScore: number;
}

export interface ScoringCriteria {
  behaviorAlignment: number;
  userPreference: number;
  contextRelevance: number;
  temporalRelevance: number;
}

class AIScorer {
  private weights = {
    behaviorAlignment: 0.35,
    userPreference: 0.3,
    contextRelevance: 0.2,
    temporalRelevance: 0.15,
  };

  /**
   * Score a single recommendation
   */
  scoreRecommendation(
    recommendation: Recommendation,
    criteria: Partial<ScoringCriteria> = {}
  ): number {
    const fullCriteria: ScoringCriteria = {
      behaviorAlignment: criteria.behaviorAlignment || 0.5,
      userPreference: criteria.userPreference || 0.5,
      contextRelevance: criteria.contextRelevance || 0.5,
      temporalRelevance: criteria.temporalRelevance || 0.5,
    };

    const score =
      fullCriteria.behaviorAlignment * this.weights.behaviorAlignment +
      fullCriteria.userPreference * this.weights.userPreference +
      fullCriteria.contextRelevance * this.weights.contextRelevance +
      fullCriteria.temporalRelevance * this.weights.temporalRelevance;

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Rank multiple recommendations
   */
  rankRecommendations(
    recommendations: Recommendation[],
    userBehavior: Record<string, number> = {},
    userPreferences: Record<string, number> = {}
  ): Recommendation[] {
    const scored = recommendations.map((rec) => {
      const criteria = this.calculateCriteria(
        rec,
        userBehavior,
        userPreferences
      );
      const score = this.scoreRecommendation(rec, criteria);
      return { ...rec, relevanceScore: score };
    });

    return scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Calculate scoring criteria for a recommendation
   */
  private calculateCriteria(
    recommendation: Recommendation,
    userBehavior: Record<string, number>,
    userPreferences: Record<string, number>
  ): ScoringCriteria {
    const behaviorScore = userBehavior[recommendation.category] || 0.5;
    const preferenceScore = userPreferences[recommendation.category] || 0.5;
    const contextScore = this.calculateContextRelevance(recommendation);
    const temporalScore = this.calculateTemporalRelevance(recommendation);

    return {
      behaviorAlignment: Math.min(behaviorScore, 1),
      userPreference: Math.min(preferenceScore, 1),
      contextRelevance: contextScore,
      temporalRelevance: temporalScore,
    };
  }

  /**
   * Calculate context relevance (0-1)
   */
  private calculateContextRelevance(recommendation: Recommendation): number {
    // Simple heuristic: longer descriptions indicate more relevant recommendations
    const wordCount = recommendation.description.split(/\s+/).length;
    return Math.min(wordCount / 100, 1);
  }

  /**
   * Calculate temporal relevance (0-1)
   */
  private calculateTemporalRelevance(recommendation: Recommendation): number {
    // In a real scenario, this would check how recent/timely the recommendation is
    // For now, return a default score
    return 0.7;
  }

  /**
   * Update scoring weights
   */
  setWeights(newWeights: Partial<typeof this.weights>): void {
    this.weights = { ...this.weights, ...newWeights };
    this.normalizeWeights();
  }

  /**
   * Normalize weights to sum to 1
   */
  private normalizeWeights(): void {
    const total = Object.values(this.weights).reduce((a, b) => a + b, 0);
    Object.keys(this.weights).forEach((key) => {
      this.weights[key as keyof typeof this.weights] /= total;
    });
  }

  /**
   * Get explanation for a score
   */
  getScoreExplanation(
    recommendation: Recommendation,
    criteria: Partial<ScoringCriteria>
  ): string {
    const score = this.scoreRecommendation(recommendation, criteria);
    return `${recommendation.title} scored ${(score * 100).toFixed(1)}% based on behavior alignment (${
      ((criteria.behaviorAlignment || 0.5) * 100).toFixed(0)
    }%), user preferences (${((criteria.userPreference || 0.5) * 100).toFixed(
      0
    )}%), and context relevance (${((criteria.contextRelevance || 0.5) * 100).toFixed(0)}%).`;
  }
}

export const aiScorer = new AIScorer();
