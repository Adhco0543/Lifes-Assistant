/**
 * backgroundJobSearch.ts - Autonomous background job searching
 * Runs on intervals, finds leads, scores them, and notifies user
 */

import { jobBoardConnector, SearchCriteria, JobOpportunity } from "./jobBoardConnector";
import { opportunityScorer, ScoredOpportunity } from "./opportunityScorer";
import { UserMemoryProfile, userMemoryProfile } from "./userMemoryProfile";
import { db } from "../public/src/lib/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  Timestamp,
} from "firebase/firestore";

export interface BackgroundSearchJob {
  id: string;
  userId: string;
  runAt: Date;
  searchCriteria: SearchCriteria;
  opportunitiesFound: number;
  hotOpportunities: number;
  warmOpportunities: number;
  status: "pending" | "running" | "completed" | "failed";
  error?: string;
  resultsStored: boolean;
}

export interface StoredOpportunity extends ScoredOpportunity {
  userId: string;
  savedAt: Date;
  actionTaken?: "emailed" | "contacted" | "dismissed" | "archived";
}

class BackgroundJobSearchClass {
  private static instance: BackgroundJobSearchClass;
  private searchIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isSearching: Set<string> = new Set();

  private constructor() {}

  static getInstance(): BackgroundJobSearchClass {
    if (!BackgroundJobSearchClass.instance) {
      BackgroundJobSearchClass.instance = new BackgroundJobSearchClass();
    }
    return BackgroundJobSearchClass.instance;
  }

  /**
   * Start automated background job search for a user
   */
  startBackgroundSearch(
    userId: string,
    intervalMinutes: number = 60
  ): void {
    // Clear existing interval
    const existingInterval = this.searchIntervals.get(userId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Run immediately first time
    this.runSearch(userId);

    // Then run on interval
    const interval = setInterval(() => {
      this.runSearch(userId);
    }, intervalMinutes * 60 * 1000);

    this.searchIntervals.set(userId, interval);
    console.log(`Background job search started for ${userId} (interval: ${intervalMinutes}m)`);
  }

  /**
   * Stop background search for user
   */
  stopBackgroundSearch(userId: string): void {
    const interval = this.searchIntervals.get(userId);
    if (interval) {
      clearInterval(interval);
      this.searchIntervals.delete(userId);
      console.log(`Background job search stopped for ${userId}`);
    }
  }

  /**
   * Run a single search job
   */
  private async runSearch(userId: string): Promise<void> {
    if (this.isSearching.has(userId)) {
      console.log(`Search already running for ${userId}, skipping`);
      return;
    }

    this.isSearching.add(userId);

    try {
      // Get user profile
      const profile = await userMemoryProfile.getProfile(userId);
      if (!profile) {
        console.error(`No profile found for ${userId}`);
        return;
      }

      // Build search criteria
      const searchCriteria = this.buildSearchCriteria(profile);

      // Search job boards
      const opportunities = await jobBoardConnector.searchAll(searchCriteria);

      if (opportunities.length === 0) {
        console.log(`No opportunities found for ${userId}`);
        return;
      }

      // Score opportunities
      const scoredOpportunities = opportunityScorer.scoreOpportunities(
        opportunities,
        profile
      );

      // Separate by recommendation
      const hotOps = scoredOpportunities.filter((o) => o.recommendation === "hot");
      const warmOps = scoredOpportunities.filter((o) => o.recommendation === "warm");

      console.log(
        `Found ${opportunities.length} opportunities: ${hotOps.length} hot, ${warmOps.length} warm`
      );

      // Store in Firestore
      await this.storeOpportunities(userId, scoredOpportunities);

      // Create search record
      const searchJob: BackgroundSearchJob = {
        id: `search-${Date.now()}`,
        userId,
        runAt: new Date(),
        searchCriteria,
        opportunitiesFound: opportunities.length,
        hotOpportunities: hotOps.length,
        warmOpportunities: warmOps.length,
        status: "completed",
        resultsStored: true,
      };

      await this.recordSearchJob(searchJob);

      // Notify user if hot opportunities found
      if (hotOps.length > 0) {
        await this.notifyUserOfHotLeads(userId, hotOps);
      }
    } catch (error) {
      console.error(`Search failed for ${userId}:`, error);
      this.isSearching.delete(userId);
    } finally {
      this.isSearching.delete(userId);
    }
  }

  /**
   * Build search criteria from user profile
   */
  private buildSearchCriteria(profile: UserMemoryProfile): SearchCriteria {
    return {
      keywords: profile.keySkills ? profile.keySkills.split(",").slice(0, 3) : ["business"],
      location: profile.businessLocation || "anywhere",
      radius: 50,
      salaryMin: 80000,
      salaryMax: 500000,
      jobType: "all",
      industry: profile.businessType,
    };
  }

  /**
   * Store opportunities in Firestore
   */
  private async storeOpportunities(
    userId: string,
    opportunities: ScoredOpportunity[]
  ): Promise<void> {
    try {
      const opportunitiesRef = collection(
        db,
        `users/${userId}/opportunities`
      );

      for (const opp of opportunities) {
        const stored: StoredOpportunity = {
          ...opp,
          userId,
          savedAt: new Date(),
        };

        // Check if opportunity already exists
        const q = query(
          opportunitiesRef,
          where("id", "==", opp.id)
        );
        const existing = await getDocs(q);

        if (existing.empty) {
          await addDoc(opportunitiesRef, {
            ...stored,
            savedAt: Timestamp.now(),
          });
        }
      }

      console.log(`Stored ${opportunities.length} opportunities for ${userId}`);
    } catch (error) {
      console.error("Failed to store opportunities:", error);
    }
  }

  /**
   * Record search job in history
   */
  private async recordSearchJob(job: BackgroundSearchJob): Promise<void> {
    try {
      const searchHistoryRef = collection(
        db,
        `users/${job.userId}/searchHistory`
      );

      await addDoc(searchHistoryRef, {
        ...job,
        runAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Failed to record search job:", error);
    }
  }

  /**
   * Notify user of hot leads
   */
  private async notifyUserOfHotLeads(
    userId: string,
    hotLeads: ScoredOpportunity[]
  ): Promise<void> {
    // In production, this would send email/notification
    console.log(
      `NOTIFICATION: Found ${hotLeads.length} hot leads for ${userId}`
    );

    const topLeads = hotLeads.slice(0, 3);
    for (const lead of topLeads) {
      console.log(`  - ${lead.title} at ${lead.company} (Score: ${lead.score})`);
    }
  }

  /**
   * Get user's stored opportunities
   */
  async getUserOpportunities(
    userId: string,
    limit: number = 50
  ): Promise<StoredOpportunity[]> {
    try {
      const opportunitiesRef = collection(
        db,
        `users/${userId}/opportunities`
      );

      const q = query(opportunitiesRef);
      const snapshot = await getDocs(q);

      const opportunities: StoredOpportunity[] = [];
      snapshot.forEach((doc) => {
        opportunities.push({
          ...doc.data(),
          savedAt: doc.data().savedAt?.toDate?.() || new Date(),
        } as StoredOpportunity);
      });

      return opportunities.sort(
        (a, b) => b.score - a.score
      ).slice(0, limit);
    } catch (error) {
      console.error("Failed to get opportunities:", error);
      return [];
    }
  }

  /**
   * Mark opportunity as actioned
   */
  async markOpportunity(
    userId: string,
    opportunityId: string,
    action: "emailed" | "contacted" | "dismissed" | "archived"
  ): Promise<void> {
    try {
      const opportunitiesRef = collection(
        db,
        `users/${userId}/opportunities`
      );

      const q = query(opportunitiesRef, where("id", "==", opportunityId));
      const snapshot = await getDocs(q);

      for (const docSnap of snapshot.docs) {
        await updateDoc(docSnap.ref, { actionTaken: action });
      }
    } catch (error) {
      console.error("Failed to mark opportunity:", error);
    }
  }

  /**
   * Get search history
   */
  async getSearchHistory(userId: string, limit: number = 30): Promise<BackgroundSearchJob[]> {
    try {
      const searchHistoryRef = collection(
        db,
        `users/${userId}/searchHistory`
      );

      const q = query(searchHistoryRef);
      const snapshot = await getDocs(q);

      const jobs: BackgroundSearchJob[] = [];
      snapshot.forEach((doc) => {
        jobs.push({
          ...doc.data(),
          runAt: doc.data().runAt?.toDate?.() || new Date(),
        } as BackgroundSearchJob);
      });

      return jobs.sort((a, b) => b.runAt.getTime() - a.runAt.getTime()).slice(0, limit);
    } catch (error) {
      console.error("Failed to get search history:", error);
      return [];
    }
  }

  /**
   * Get currently running searches
   */
  getRunningSearches(): string[] {
    return Array.from(this.isSearching);
  }

  /**
   * Get all active search intervals
   */
  getActiveIntervals(): string[] {
    return Array.from(this.searchIntervals.keys());
  }
}

export const backgroundJobSearch = BackgroundJobSearchClass.getInstance();
