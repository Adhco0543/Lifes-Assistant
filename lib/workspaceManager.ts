/**
 * Multi-User Workspace Management System
 * Handles team workspaces, role-based permissions, and collaboration
 */

export type UserRole = 'owner' | 'admin' | 'manager' | 'user' | 'viewer';

export interface WorkspaceUser {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  joinedAt: number;
  lastActive: number;
}

export interface WorkspaceSettings {
  name: string;
  description: string;
  currency: string;
  timezone: string;
  defaultTaxRate: number;
  notificationSettings: {
    emailNotifications: boolean;
    slackNotifications: boolean;
    frequencyPreference: 'instant' | 'daily' | 'weekly';
  };
}

export interface Workspace {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  users: WorkspaceUser[];
  settings: WorkspaceSettings;
  isActive: boolean;
  maxUsers: number;
}

export interface RolePermissions {
  [key: string]: {
    canViewQuotes: boolean;
    canCreateQuotes: boolean;
    canEditQuotes: boolean;
    canDeleteQuotes: boolean;
    canViewNotes: boolean;
    canCreateNotes: boolean;
    canEditAllNotes: boolean;
    canViewAnalytics: boolean;
    canViewReports: boolean;
    canViewTeamMembers: boolean;
    canInviteUsers: boolean;
    canManageRoles: boolean;
    canEditWorkspaceSettings: boolean;
    canDeleteWorkspace: boolean;
    canViewAuditLog: boolean;
    canApproveQuotes: boolean;
    canAccessClientPortal: boolean;
  };
}

export interface AuditLogEntry {
  id: string;
  workspaceId: string;
  userId: string;
  action: string;
  resourceType: 'quote' | 'note' | 'user' | 'workspace' | 'report';
  resourceId: string;
  timestamp: number;
  changes: Record<string, { before: any; after: any }>;
  ipAddress?: string;
  userAgent?: string;
}

// Role-based permissions matrix
const ROLE_PERMISSIONS: RolePermissions = {
  owner: {
    canViewQuotes: true,
    canCreateQuotes: true,
    canEditQuotes: true,
    canDeleteQuotes: true,
    canViewNotes: true,
    canCreateNotes: true,
    canEditAllNotes: true,
    canViewAnalytics: true,
    canViewReports: true,
    canViewTeamMembers: true,
    canInviteUsers: true,
    canManageRoles: true,
    canEditWorkspaceSettings: true,
    canDeleteWorkspace: true,
    canViewAuditLog: true,
    canApproveQuotes: true,
    canAccessClientPortal: true,
  },
  admin: {
    canViewQuotes: true,
    canCreateQuotes: true,
    canEditQuotes: true,
    canDeleteQuotes: true,
    canViewNotes: true,
    canCreateNotes: true,
    canEditAllNotes: true,
    canViewAnalytics: true,
    canViewReports: true,
    canViewTeamMembers: true,
    canInviteUsers: true,
    canManageRoles: false,
    canEditWorkspaceSettings: false,
    canDeleteWorkspace: false,
    canViewAuditLog: true,
    canApproveQuotes: true,
    canAccessClientPortal: true,
  },
  manager: {
    canViewQuotes: true,
    canCreateQuotes: true,
    canEditQuotes: true,
    canDeleteQuotes: false,
    canViewNotes: true,
    canCreateNotes: true,
    canEditAllNotes: false,
    canViewAnalytics: true,
    canViewReports: true,
    canViewTeamMembers: true,
    canInviteUsers: false,
    canManageRoles: false,
    canEditWorkspaceSettings: false,
    canDeleteWorkspace: false,
    canViewAuditLog: false,
    canApproveQuotes: false,
    canAccessClientPortal: true,
  },
  user: {
    canViewQuotes: true,
    canCreateQuotes: true,
    canEditQuotes: true,
    canDeleteQuotes: false,
    canViewNotes: true,
    canCreateNotes: true,
    canEditAllNotes: false,
    canViewAnalytics: false,
    canViewReports: false,
    canViewTeamMembers: false,
    canInviteUsers: false,
    canManageRoles: false,
    canEditWorkspaceSettings: false,
    canDeleteWorkspace: false,
    canViewAuditLog: false,
    canApproveQuotes: false,
    canAccessClientPortal: false,
  },
  viewer: {
    canViewQuotes: true,
    canCreateQuotes: false,
    canEditQuotes: false,
    canDeleteQuotes: false,
    canViewNotes: true,
    canCreateNotes: false,
    canEditAllNotes: false,
    canViewAnalytics: false,
    canViewReports: false,
    canViewTeamMembers: false,
    canInviteUsers: false,
    canManageRoles: false,
    canEditWorkspaceSettings: false,
    canDeleteWorkspace: false,
    canViewAuditLog: false,
    canApproveQuotes: false,
    canAccessClientPortal: false,
  },
};

class WorkspaceManager {
  private workspaces: Workspace[] = [];
  private auditLog: AuditLogEntry[] = [];
  private storageKey = 'workspaces';
  private auditKey = 'audit_log';

  constructor() {
    this.loadWorkspaces();
    this.loadAuditLog();
  }

  /**
   * Create new workspace
   */
  createWorkspace(
    ownerId: string,
    ownerEmail: string,
    ownerName: string,
    name: string,
    description: string = ''
  ): Workspace {
    const workspace: Workspace = {
      id: `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ownerId,
      name,
      description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      users: [
        {
          userId: ownerId,
          email: ownerEmail,
          name: ownerName,
          role: 'owner',
          joinedAt: Date.now(),
          lastActive: Date.now(),
        },
      ],
      settings: {
        name,
        description,
        currency: 'USD',
        timezone: 'UTC',
        defaultTaxRate: 0.1,
        notificationSettings: {
          emailNotifications: true,
          slackNotifications: false,
          frequencyPreference: 'instant',
        },
      },
      isActive: true,
      maxUsers: 50,
    };

    this.workspaces.push(workspace);
    this.saveWorkspaces();
    this.logAction(ownerId, 'workspace_created', 'workspace', workspace.id, {});

    return workspace;
  }

  /**
   * Add user to workspace
   */
  addUserToWorkspace(
    workspaceId: string,
    userId: string,
    email: string,
    name: string,
    role: UserRole = 'user',
    addedByUserId: string
  ): Workspace {
    const workspace = this.workspaces.find((w) => w.id === workspaceId);
    if (!workspace) throw new Error('Workspace not found');

    // Check if user already exists
    const existingUser = workspace.users.find((u) => u.userId === userId);
    if (existingUser) throw new Error('User already in workspace');

    // Check max users limit
    if (workspace.users.length >= workspace.maxUsers) {
      throw new Error('Workspace user limit reached');
    }

    const newUser: WorkspaceUser = {
      userId,
      email,
      name,
      role,
      joinedAt: Date.now(),
      lastActive: Date.now(),
    };

    workspace.users.push(newUser);
    workspace.updatedAt = Date.now();

    this.saveWorkspaces();
    this.logAction(addedByUserId, 'user_added', 'user', userId, {
      workspaceId,
      role,
    });

    return workspace;
  }

  /**
   * Update user role in workspace
   */
  updateUserRole(
    workspaceId: string,
    userId: string,
    newRole: UserRole,
    updatedByUserId: string
  ): Workspace {
    const workspace = this.workspaces.find((w) => w.id === workspaceId);
    if (!workspace) throw new Error('Workspace not found');

    const user = workspace.users.find((u) => u.userId === userId);
    if (!user) throw new Error('User not found in workspace');

    const oldRole = user.role;
    user.role = newRole;
    workspace.updatedAt = Date.now();

    this.saveWorkspaces();
    this.logAction(updatedByUserId, 'role_updated', 'user', userId, {
      oldRole,
      newRole,
    });

    return workspace;
  }

  /**
   * Remove user from workspace
   */
  removeUserFromWorkspace(
    workspaceId: string,
    userId: string,
    removedByUserId: string
  ): Workspace {
    const workspace = this.workspaces.find((w) => w.id === workspaceId);
    if (!workspace) throw new Error('Workspace not found');

    if (workspace.ownerId === userId && removedByUserId !== userId) {
      throw new Error('Cannot remove workspace owner');
    }

    workspace.users = workspace.users.filter((u) => u.userId !== userId);
    workspace.updatedAt = Date.now();

    this.saveWorkspaces();
    this.logAction(removedByUserId, 'user_removed', 'user', userId, {
      workspaceId,
    });

    return workspace;
  }

  /**
   * Get workspace by ID
   */
  getWorkspace(workspaceId: string): Workspace | null {
    return this.workspaces.find((w) => w.id === workspaceId) || null;
  }

  /**
   * Get all workspaces for a user
   */
  getUserWorkspaces(userId: string): Workspace[] {
    return this.workspaces.filter((w) =>
      w.users.some((u) => u.userId === userId)
    );
  }

  /**
   * Check if user has permission
   */
  hasPermission(
    workspaceId: string,
    userId: string,
    permission: keyof typeof ROLE_PERMISSIONS.owner
  ): boolean {
    const workspace = this.workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return false;

    const user = workspace.users.find((u) => u.userId === userId);
    if (!user) return false;

    return ROLE_PERMISSIONS[user.role][permission];
  }

  /**
   * Get user permissions in workspace
   */
  getUserPermissions(workspaceId: string, userId: string) {
    const workspace = this.workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return null;

    const user = workspace.users.find((u) => u.userId === userId);
    if (!user) return null;

    return ROLE_PERMISSIONS[user.role];
  }

  /**
   * Update workspace settings
   */
  updateWorkspaceSettings(
    workspaceId: string,
    settings: Partial<WorkspaceSettings>,
    updatedByUserId: string
  ): Workspace {
    const workspace = this.workspaces.find((w) => w.id === workspaceId);
    if (!workspace) throw new Error('Workspace not found');

    Object.assign(workspace.settings, settings);
    workspace.updatedAt = Date.now();

    this.saveWorkspaces();
    this.logAction(updatedByUserId, 'settings_updated', 'workspace', workspaceId, settings);

    return workspace;
  }

  /**
   * Log action for audit trail
   */
  private logAction(
    userId: string,
    action: string,
    resourceType: 'quote' | 'note' | 'user' | 'workspace' | 'report',
    resourceId: string,
    changes: Record<string, any>
  ): void {
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      workspaceId: '', // Will be set by context
      userId,
      action,
      resourceType,
      resourceId,
      timestamp: Date.now(),
      changes,
    };

    this.auditLog.push(entry);
    this.saveAuditLog();
  }

  /**
   * Get audit log for workspace
   */
  getAuditLog(workspaceId: string, limit: number = 100): AuditLogEntry[] {
    return this.auditLog
      .filter((entry) => entry.workspaceId === workspaceId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get audit log for specific user
   */
  getUserAuditLog(workspaceId: string, userId: string, limit: number = 50): AuditLogEntry[] {
    return this.auditLog
      .filter((entry) => entry.workspaceId === workspaceId && entry.userId === userId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Update user last active time
   */
  updateLastActive(workspaceId: string, userId: string): void {
    const workspace = this.workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return;

    const user = workspace.users.find((u) => u.userId === userId);
    if (user) {
      user.lastActive = Date.now();
      this.saveWorkspaces();
    }
  }

  /**
   * Get team members in workspace
   */
  getTeamMembers(workspaceId: string): WorkspaceUser[] {
    const workspace = this.workspaces.find((w) => w.id === workspaceId);
    return workspace ? workspace.users : [];
  }

  /**
   * Delete workspace (owner only)
   */
  deleteWorkspace(workspaceId: string, deletedByUserId: string): void {
    const workspace = this.workspaces.find((w) => w.id === workspaceId);
    if (!workspace) throw new Error('Workspace not found');

    if (workspace.ownerId !== deletedByUserId) {
      throw new Error('Only owner can delete workspace');
    }

    this.workspaces = this.workspaces.filter((w) => w.id !== workspaceId);
    this.logAction(deletedByUserId, 'workspace_deleted', 'workspace', workspaceId, {});
    this.saveWorkspaces();
  }

  /**
   * Save workspaces to localStorage
   */
  private saveWorkspaces(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.workspaces));
    } catch (e) {
      console.warn('Failed to save workspaces:', e);
    }
  }

  /**
   * Load workspaces from localStorage
   */
  private loadWorkspaces(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      this.workspaces = stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn('Failed to load workspaces:', e);
    }
  }

  /**
   * Save audit log to localStorage
   */
  private saveAuditLog(): void {
    try {
      localStorage.setItem(this.auditKey, JSON.stringify(this.auditLog));
    } catch (e) {
      console.warn('Failed to save audit log:', e);
    }
  }

  /**
   * Load audit log from localStorage
   */
  private loadAuditLog(): void {
    try {
      const stored = localStorage.getItem(this.auditKey);
      this.auditLog = stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn('Failed to load audit log:', e);
    }
  }
}

export const workspaceManager = new WorkspaceManager();
