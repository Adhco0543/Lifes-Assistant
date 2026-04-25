'use client';

import React, { useState, useEffect } from 'react';
import { workspaceManager, UserRole } from '../lib/workspaceManager';
import { RichMedia } from './Richmedia';

interface TeamManagementProps {
  workspaceId: string;
  userId: string;
}

export const TeamManagement: React.FC<TeamManagementProps> = ({ workspaceId, userId }) => {
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('user');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  // Load team members
  useEffect(() => {
    try {
      const workspace = workspaceManager.getWorkspace(workspaceId);
      if (workspace) {
        setTeamMembers(workspace.users);
      }
    } catch (error) {
      setErrorMessage('Failed to load team members');
    }
  }, [workspaceId]);

  // Add team member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberEmail.trim() || !newMemberName.trim()) {
      setErrorMessage('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const newUserId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const workspace = workspaceManager.addUserToWorkspace(
        workspaceId,
        newUserId,
        newMemberEmail,
        newMemberName,
        selectedRole,
        userId
      );

      setTeamMembers(workspace.users);
      setNewMemberEmail('');
      setNewMemberName('');
      setSelectedRole('user');
      setSuccessMessage(`${newMemberName} added as ${selectedRole}`);

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to add member');
    } finally {
      setIsLoading(false);
    }
  };

  // Update member role
  const handleUpdateRole = async (memberId: string, newRole: UserRole) => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const workspace = workspaceManager.updateUserRole(
        workspaceId,
        memberId,
        newRole,
        userId
      );

      setTeamMembers(workspace.users);
      setSuccessMessage('Role updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update role');
    } finally {
      setIsLoading(false);
    }
  };

  // Remove member
  const handleRemoveMember = async (memberId: string) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const workspace = workspaceManager.removeUserFromWorkspace(
        workspaceId,
        memberId,
        userId
      );

      setTeamMembers(workspace.users);
      setSuccessMessage('Member removed successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to remove member');
    } finally {
      setIsLoading(false);
    }
  };

  const currentUser = teamMembers.find((m) => m.userId === userId);
  const isOwnerOrAdmin =
    currentUser?.role === 'owner' || currentUser?.role === 'admin';

  const getRoleColor = (role: UserRole) => {
    const colors: Record<UserRole, string> = {
      owner: '#FF6B6B',
      admin: '#FF922B',
      manager: '#FFD43B',
      user: '#4ECDC4',
      viewer: '#95E1D3',
    };
    return colors[role];
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>
          <RichMedia icon="user" size="md" /> Team Members
        </h2>
        <p>{teamMembers.length} members in this workspace</p>
      </div>

      {successMessage && (
        <div style={styles.successAlert}>
          <RichMedia icon="success" size="sm" />
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div style={styles.errorAlert}>
          <RichMedia icon="alert" size="sm" />
          {errorMessage}
        </div>
      )}

      {isOwnerOrAdmin && (
        <div style={styles.addMemberSection}>
          <h3>Add Team Member</h3>
          <form onSubmit={handleAddMember} style={styles.form}>
            <div style={styles.formGroup}>
              <label>Email Address *</label>
              <input
                type="email"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="member@example.com"
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label>Full Name *</label>
              <input
                type="text"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="John Doe"
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label>Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                style={styles.select}
              >
                <option value="viewer">Viewer (read-only)</option>
                <option value="user">User (standard access)</option>
                <option value="manager">Manager (team lead)</option>
                <option value="admin">Admin (full access)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                ...styles.button,
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading ? 'Adding...' : 'Add Member'}
            </button>
          </form>
        </div>
      )}

      <div style={styles.membersList}>
        <h3>Team Members</h3>
        {teamMembers.length === 0 ? (
          <div style={styles.emptyState}>
            <p>No team members yet</p>
          </div>
        ) : (
          <div style={styles.membersGrid}>
            {teamMembers.map((member) => (
              <div key={member.userId} style={styles.memberCard}>
                <div style={styles.memberHeader}>
                  <div>
                    <h4>{member.name}</h4>
                    <p style={styles.memberEmail}>{member.email}</p>
                  </div>
                  <span
                    style={{
                      ...styles.roleBadge,
                      backgroundColor: getRoleColor(member.role),
                    }}
                  >
                    {member.role}
                  </span>
                </div>

                <div style={styles.memberMeta}>
                  <small>Joined {new Date(member.joinedAt).toLocaleDateString()}</small>
                  <small>
                    Last active:{' '}
                    {Math.round(
                      (Date.now() - member.lastActive) / (1000 * 60)
                    )}{' '}
                    min ago
                  </small>
                </div>

                {isOwnerOrAdmin && member.userId !== userId && (
                  <div style={styles.memberActions}>
                    <select
                      value={member.role}
                      onChange={(e) =>
                        handleUpdateRole(
                          member.userId,
                          e.target.value as UserRole
                        )
                      }
                      style={styles.roleSelect}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="user">User</option>
                      <option value="manager">Manager</option>
                      {currentUser?.role === 'owner' && (
                        <option value="admin">Admin</option>
                      )}
                    </select>

                    {currentUser?.role === 'owner' &&
                      member.role !== 'owner' && (
                        <button
                          onClick={() => handleRemoveMember(member.userId)}
                          style={styles.removeButton}
                          disabled={isLoading}
                        >
                          Remove
                        </button>
                      )}
                  </div>
                )}

                {member.userId === userId && (
                  <div style={styles.yourMark}>
                    <small>👤 This is you</small>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.permissionsInfo}>
        <h3>Role Permissions Guide</h3>
        <div style={styles.permissionsGrid}>
          <div style={styles.permissionCard}>
            <h4>Viewer</h4>
            <ul>
              <li>View quotes and notes</li>
              <li>Read-only access</li>
              <li>No creation or editing</li>
            </ul>
          </div>

          <div style={styles.permissionCard}>
            <h4>User</h4>
            <ul>
              <li>Create and edit quotes</li>
              <li>Create and edit own notes</li>
              <li>Basic analytics access</li>
            </ul>
          </div>

          <div style={styles.permissionCard}>
            <h4>Manager</h4>
            <ul>
              <li>All user capabilities</li>
              <li>Edit all notes</li>
              <li>Full analytics and reports</li>
            </ul>
          </div>

          <div style={styles.permissionCard}>
            <h4>Admin</h4>
            <ul>
              <li>All manager capabilities</li>
              <li>Manage team members</li>
              <li>Audit logs access</li>
            </ul>
          </div>
        </div>
      </div>

      <style jsx>{`
        ${getStyles()}
      `}</style>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '0.75rem',
  },
  header: {
    marginBottom: '2rem',
  },
  successAlert: {
    display: 'flex' as const,
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    marginBottom: '1.5rem',
    backgroundColor: '#d4edda',
    color: '#155724',
    borderRadius: '0.5rem',
    border: '1px solid #c3e6cb',
  },
  errorAlert: {
    display: 'flex' as const,
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    marginBottom: '1.5rem',
    backgroundColor: '#f8d7da',
    color: '#721c24',
    borderRadius: '0.5rem',
    border: '1px solid #f5c6cb',
  },
  addMemberSection: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '0.75rem',
    marginBottom: '2rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  form: {
    display: 'grid' as const,
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1rem',
    marginTop: '1rem',
  },
  formGroup: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  input: {
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '0.5rem',
    fontSize: '1rem',
  },
  select: {
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '0.5rem',
    fontSize: '1rem',
  },
  button: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  membersList: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '0.75rem',
    marginBottom: '2rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '2rem',
    color: '#666',
  },
  membersGrid: {
    display: 'grid' as const,
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '1.5rem',
    marginTop: '1rem',
  },
  memberCard: {
    border: '1px solid #e0e0e0',
    borderRadius: '0.5rem',
    padding: '1.25rem',
    backgroundColor: '#fafafa',
  },
  memberHeader: {
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    marginBottom: '1rem',
  },
  memberEmail: {
    color: '#666',
    fontSize: '0.9rem',
    margin: '0.25rem 0 0 0',
  },
  roleBadge: {
    padding: '0.35rem 0.75rem',
    borderRadius: '9999px',
    color: 'white',
    fontSize: '0.85rem',
    fontWeight: 'bold',
  },
  memberMeta: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '0.25rem',
    fontSize: '0.85rem',
    color: '#999',
    marginBottom: '1rem',
  },
  memberActions: {
    display: 'flex' as const,
    gap: '0.75rem',
  },
  roleSelect: {
    flex: 1,
    padding: '0.5rem',
    border: '1px solid #ddd',
    borderRadius: '0.35rem',
    fontSize: '0.9rem',
  },
  removeButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '0.35rem',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  yourMark: {
    marginTop: '1rem',
    padding: '0.5rem',
    backgroundColor: '#e7f3ff',
    borderRadius: '0.35rem',
    textAlign: 'center' as const,
  },
  permissionsInfo: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '0.75rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  permissionsGrid: {
    display: 'grid' as const,
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1.5rem',
    marginTop: '1rem',
  },
  permissionCard: {
    padding: '1rem',
    border: '1px solid #e0e0e0',
    borderRadius: '0.5rem',
    backgroundColor: '#f9f9f9',
  },
};

function getStyles() {
  return `
    h2 { display: flex; align-items: center; gap: 0.75rem; margin: 0 0 0.5rem 0; }
    h3 { font-size: 1.25rem; margin: 0 0 1rem 0; }
    h4 { margin: 0 0 0.5rem 0; }
    p { margin: 0; color: #666; }
    ul { padding-left: 1.5rem; margin: 0.5rem 0 0 0; }
    li { margin: 0.35rem 0; font-size: 0.9rem; }
    button:hover:not(:disabled) { background-color: #0056b3; }
    button:disabled { cursor: not-allowed; opacity: 0.6; }
    select { cursor: pointer; }
  `;
}
