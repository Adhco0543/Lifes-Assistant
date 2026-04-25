'use client';

/**
 * Workspace Management Hook
 * Provides workspace context and permission checking
 */

import { useContext, createContext, useCallback, useState, useEffect } from 'react';
import { workspaceManager, Workspace, UserRole, WorkspaceUser } from '../lib/workspaceManager';

export interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  currentUserRole: UserRole | null;
  teamMembers: WorkspaceUser[];
  hasPermission: (permission: string) => boolean;
  switchWorkspace: (workspaceId: string) => void;
  addTeamMember: (email: string, name: string, role: UserRole) => Promise<void>;
  updateMemberRole: (userId: string, newRole: UserRole) => Promise<void>;
  removeTeamMember: (userId: string) => Promise<void>;
  getWorkspaces: () => Workspace[];
  isLoading: boolean;
}

export const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

/**
 * Hook to use workspace context
 */
export function useWorkspace(): WorkspaceContextType {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }
  return context;
}

/**
 * Hook for permission checking
 */
export function usePermission(permission: string): boolean {
  const { hasPermission } = useWorkspace();
  return hasPermission(permission);
}

/**
 * Hook for team collaboration
 */
export function useTeamCollaboration(workspaceId: string) {
  const [teamMembers, setTeamMembers] = useState<WorkspaceUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadTeamMembers = () => {
      try {
        const workspace = workspaceManager.getWorkspace(workspaceId);
        if (workspace) {
          setTeamMembers(workspace.users);
        }
      } catch (error) {
        console.error('Error loading team members:', error);
      }
    };

    loadTeamMembers();
  }, [workspaceId]);

  const addMember = useCallback(
    async (email: string, name: string, role: UserRole, currentUserId: string) => {
      setIsLoading(true);
      try {
        const userId = `user-${Date.now()}`;
        const workspace = workspaceManager.addUserToWorkspace(
          workspaceId,
          userId,
          email,
          name,
          role,
          currentUserId
        );
        setTeamMembers(workspace.users);
      } catch (error) {
        console.error('Error adding member:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceId]
  );

  const updateMember = useCallback(
    async (userId: string, newRole: UserRole, currentUserId: string) => {
      setIsLoading(true);
      try {
        const workspace = workspaceManager.updateUserRole(
          workspaceId,
          userId,
          newRole,
          currentUserId
        );
        setTeamMembers(workspace.users);
      } catch (error) {
        console.error('Error updating member:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceId]
  );

  const removeMember = useCallback(
    async (userId: string, currentUserId: string) => {
      setIsLoading(true);
      try {
        const workspace = workspaceManager.removeUserFromWorkspace(
          workspaceId,
          userId,
          currentUserId
        );
        setTeamMembers(workspace.users);
      } catch (error) {
        console.error('Error removing member:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceId]
  );

  return {
    teamMembers,
    isLoading,
    addMember,
    updateMember,
    removeMember,
  };
}

/**
 * Hook for audit trail
 */
export function useAuditTrail(workspaceId: string) {
  const [auditLog, setAuditLog] = useState<any[]>([]);

  useEffect(() => {
    try {
      const log = workspaceManager.getAuditLog(workspaceId, 50);
      setAuditLog(log);
    } catch (error) {
      console.error('Error loading audit log:', error);
    }
  }, [workspaceId]);

  return { auditLog };
}
