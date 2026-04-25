/**
 * teamWorkspaceManager.ts - Multi-user team collaboration
 * Workspace sharing, role-based permissions, activity logs
 */

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
  deleteDoc,
} from "firebase/firestore";

export type TeamRole = "owner" | "manager" | "executor" | "viewer";

export interface TeamMember {
  userId: string;
  email: string;
  name: string;
  role: TeamRole;
  joinedAt: Date;
  isActive: boolean;
}

export interface TeamWorkspace {
  workspaceId: string;
  name: string;
  description: string;
  owner: string;
  members: TeamMember[];
  createdAt: Date;
  updatedAt: Date;
  settings: TeamSettings;
}

export interface TeamSettings {
  allowPublicSharing: boolean;
  requireApprovalForTasks: boolean;
  taskExecutionMode: "autonomous" | "supervised" | "manual";
  enableActivityLog: boolean;
  enableNotifications: boolean;
  retentionDays: number;
}

export interface ActivityLog {
  id: string;
  workspaceId: string;
  userId: string;
  action: string;
  target: string;
  details: Record<string, any>;
  timestamp: Date;
}

export interface SharedTask {
  taskId: string;
  workspaceId: string;
  title: string;
  description: string;
  createdBy: string;
  assignedTo?: string;
  status: "draft" | "pending" | "executing" | "completed" | "failed";
  result?: string;
  createdAt: Date;
  completedAt?: Date;
}

class TeamWorkspaceManagerClass {
  private static instance: TeamWorkspaceManagerClass;

  private constructor() {}

  static getInstance(): TeamWorkspaceManagerClass {
    if (!TeamWorkspaceManagerClass.instance) {
      TeamWorkspaceManagerClass.instance = new TeamWorkspaceManagerClass();
    }
    return TeamWorkspaceManagerClass.instance;
  }

  /**
   * Create a new team workspace
   */
  async createWorkspace(
    ownerId: string,
    name: string,
    description: string
  ): Promise<TeamWorkspace> {
    try {
      const workspace: TeamWorkspace = {
        workspaceId: `ws-${Date.now()}`,
        name,
        description,
        owner: ownerId,
        members: [
          {
            userId: ownerId,
            email: `user-${ownerId}@business-ai.app`,
            name: "Owner",
            role: "owner",
            joinedAt: new Date(),
            isActive: true,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        settings: {
          allowPublicSharing: false,
          requireApprovalForTasks: false,
          taskExecutionMode: "autonomous",
          enableActivityLog: true,
          enableNotifications: true,
          retentionDays: 90,
        },
      };

      const workspacesRef = collection(db, "workspaces");
      const docRef = await addDoc(workspacesRef, {
        ...workspace,
        createdAt: Timestamp.fromDate(workspace.createdAt),
        updatedAt: Timestamp.fromDate(workspace.updatedAt),
        members: workspace.members.map((m) => ({
          ...m,
          joinedAt: Timestamp.fromDate(m.joinedAt),
        })),
      });

      workspace.workspaceId = docRef.id;

      // Log activity
      await this.logActivity(workspace.workspaceId, ownerId, "workspace_created", workspace.workspaceId, {
        name,
        description,
      });

      return workspace;
    } catch (error) {
      console.error("Failed to create workspace:", error);
      throw error;
    }
  }

  /**
   * Add member to workspace
   */
  async addMember(
    workspaceId: string,
    userId: string,
    email: string,
    role: TeamRole = "executor",
    addedBy: string
  ): Promise<TeamMember> {
    try {
      const workspacesRef = collection(db, "workspaces");
      const q = query(workspacesRef, where("workspaceId", "==", workspaceId));
      const snapshot = await getDocs(q);

      const newMember: TeamMember = {
        userId,
        email,
        name: email.split("@")[0],
        role,
        joinedAt: new Date(),
        isActive: true,
      };

      for (const docSnap of snapshot.docs) {
        const currentData = docSnap.data();
        const members = currentData.members || [];

        await updateDoc(docSnap.ref, {
          members: [...members, { ...newMember, joinedAt: Timestamp.fromDate(newMember.joinedAt) }],
          updatedAt: Timestamp.now(),
        });

        // Log activity
        await this.logActivity(workspaceId, addedBy, "member_added", userId, {
          email,
          role,
        });
      }

      return newMember;
    } catch (error) {
      console.error("Failed to add member:", error);
      throw error;
    }
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    workspaceId: string,
    userId: string,
    newRole: TeamRole,
    updatedBy: string
  ): Promise<void> {
    try {
      const workspacesRef = collection(db, "workspaces");
      const q = query(workspacesRef, where("workspaceId", "==", workspaceId));
      const snapshot = await getDocs(q);

      for (const docSnap of snapshot.docs) {
        const currentData = docSnap.data();
        const members = currentData.members || [];

        const updatedMembers = members.map((m: any) =>
          m.userId === userId ? { ...m, role: newRole } : m
        );

        await updateDoc(docSnap.ref, {
          members: updatedMembers,
          updatedAt: Timestamp.now(),
        });

        // Log activity
        await this.logActivity(workspaceId, updatedBy, "member_role_updated", userId, {
          newRole,
        });
      }
    } catch (error) {
      console.error("Failed to update member role:", error);
      throw error;
    }
  }

  /**
   * Remove member from workspace
   */
  async removeMember(
    workspaceId: string,
    userId: string,
    removedBy: string
  ): Promise<void> {
    try {
      const workspacesRef = collection(db, "workspaces");
      const q = query(workspacesRef, where("workspaceId", "==", workspaceId));
      const snapshot = await getDocs(q);

      for (const docSnap of snapshot.docs) {
        const currentData = docSnap.data();
        const members = currentData.members || [];

        const updatedMembers = members.filter((m: any) => m.userId !== userId);

        await updateDoc(docSnap.ref, {
          members: updatedMembers,
          updatedAt: Timestamp.now(),
        });

        // Log activity
        await this.logActivity(workspaceId, removedBy, "member_removed", userId, {});
      }
    } catch (error) {
      console.error("Failed to remove member:", error);
      throw error;
    }
  }

  /**
   * Check if user can perform action
   */
  async canUserPerformAction(
    workspaceId: string,
    userId: string,
    action: string
  ): Promise<boolean> {
    try {
      const workspace = await this.getWorkspace(workspaceId);
      const member = workspace?.members.find((m) => m.userId === userId);

      if (!member) return false;

      // Define permissions by role
      const permissions: Record<TeamRole, string[]> = {
        owner: ["*"],
        manager: [
          "view_tasks",
          "create_tasks",
          "execute_tasks",
          "manage_members",
          "view_logs",
        ],
        executor: ["view_tasks", "create_tasks", "execute_tasks"],
        viewer: ["view_tasks", "view_logs"],
      };

      const userPermissions = permissions[member.role] || [];
      return userPermissions.includes("*") || userPermissions.includes(action);
    } catch (error) {
      console.error("Permission check failed:", error);
      return false;
    }
  }

  /**
   * Get workspace
   */
  async getWorkspace(workspaceId: string): Promise<TeamWorkspace | null> {
    try {
      const workspacesRef = collection(db, "workspaces");
      const q = query(workspacesRef, where("workspaceId", "==", workspaceId));
      const snapshot = await getDocs(q);

      if (snapshot.empty) return null;

      const doc = snapshot.docs[0];
      const data = doc.data();

      return {
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
        members: data.members?.map((m: any) => ({
          ...m,
          joinedAt: m.joinedAt?.toDate?.() || new Date(),
        })) || [],
      } as TeamWorkspace;
    } catch (error) {
      console.error("Failed to get workspace:", error);
      return null;
    }
  }

  /**
   * Get user's workspaces
   */
  async getUserWorkspaces(userId: string): Promise<TeamWorkspace[]> {
    try {
      const workspacesRef = collection(db, "workspaces");
      const q = query(workspacesRef);
      const snapshot = await getDocs(q);

      const workspaces: TeamWorkspace[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const workspace = {
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
          members: data.members?.map((m: any) => ({
            ...m,
            joinedAt: m.joinedAt?.toDate?.() || new Date(),
          })) || [],
        } as TeamWorkspace;

        // Check if user is member
        if (workspace.members.some((m) => m.userId === userId)) {
          workspaces.push(workspace);
        }
      });

      return workspaces;
    } catch (error) {
      console.error("Failed to get user workspaces:", error);
      return [];
    }
  }

  /**
   * Share task with workspace
   */
  async shareTaskWithWorkspace(
    workspaceId: string,
    taskId: string,
    title: string,
    description: string,
    createdBy: string,
    assignedTo?: string
  ): Promise<SharedTask> {
    try {
      const sharedTask: SharedTask = {
        taskId,
        workspaceId,
        title,
        description,
        createdBy,
        assignedTo,
        status: "draft",
        createdAt: new Date(),
      };

      const tasksRef = collection(db, `workspaces/${workspaceId}/sharedTasks`);
      await addDoc(tasksRef, {
        ...sharedTask,
        createdAt: Timestamp.fromDate(sharedTask.createdAt),
      });

      // Log activity
      await this.logActivity(workspaceId, createdBy, "task_shared", taskId, {
        title,
        assignedTo,
      });

      return sharedTask;
    } catch (error) {
      console.error("Failed to share task:", error);
      throw error;
    }
  }

  /**
   * Get workspace tasks
   */
  async getWorkspaceTasks(workspaceId: string): Promise<SharedTask[]> {
    try {
      const tasksRef = collection(db, `workspaces/${workspaceId}/sharedTasks`);
      const q = query(tasksRef);
      const snapshot = await getDocs(q);

      const tasks: SharedTask[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        tasks.push({
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          completedAt: data.completedAt?.toDate?.(),
        } as SharedTask);
      });

      return tasks;
    } catch (error) {
      console.error("Failed to get workspace tasks:", error);
      return [];
    }
  }

  /**
   * Log activity in workspace
   */
  async logActivity(
    workspaceId: string,
    userId: string,
    action: string,
    target: string,
    details: Record<string, any>
  ): Promise<void> {
    try {
      const logsRef = collection(db, `workspaces/${workspaceId}/activityLog`);
      const timestamp = Timestamp.now();

      await addDoc(logsRef, {
        userId,
        action,
        target,
        details,
        timestamp,
      });
    } catch (error) {
      console.error("Failed to log activity:", error);
    }
  }

  /**
   * Get activity log
   */
  async getActivityLog(
    workspaceId: string,
    limit: number = 100
  ): Promise<ActivityLog[]> {
    try {
      const logsRef = collection(db, `workspaces/${workspaceId}/activityLog`);
      const q = query(logsRef);
      const snapshot = await getDocs(q);

      const logs: ActivityLog[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        logs.push({
          id: doc.id,
          workspaceId,
          userId: data.userId,
          action: data.action,
          target: data.target,
          details: data.details,
          timestamp: data.timestamp?.toDate?.() || new Date(),
        });
      });

      return logs
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);
    } catch (error) {
      console.error("Failed to get activity log:", error);
      return [];
    }
  }
}

export const teamWorkspaceManager = TeamWorkspaceManagerClass.getInstance();
