import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import { useNotificationStore } from '../store';
import { createClient } from '@supabase/supabase-js';
import { Plus, Trash2 } from 'lucide-react';

export const UsersView: React.FC = () => {
  const { showToast, showConfirm } = useNotificationStore();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // Registration Form States (for admin to add cashiers)
  const [showAddModal, setShowAddModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('cashier');
  const [formLoading, setFormLoading] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const list = await dbService.getUsers();
      setUsers(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setFormLoading(true);
    showToast('Registering staff user...', 'info');

    try {
      // Initialize a secondary client to register staff without logging out the admin
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const secondaryClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });

      // Call signUp on the secondary client
      const { error } = await secondaryClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || 'Shop Staff',
            role: role
          }
        }
      });

      if (error) throw error;

      showToast(`Account created successfully for ${email}!`, 'success');
      setShowAddModal(false);
      setFullName('');
      setEmail('');
      setPassword('');
      setRole('cashier');
      
      // Delay reload slightly to let backend triggers finish syncing the user table
      setTimeout(() => {
        loadUsers();
      }, 1000);

    } catch (err: any) {
      showToast(err.message || 'Failed to create staff account', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      showToast('Updating role...', 'info');
      await dbService.updateUserRole(userId, newRole);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      showToast('User role updated successfully!', 'success');
    } catch (e) {
      showToast('Failed to update role', 'error');
    }
  };

  const handleDeleteUser = (userId: string) => {
    showConfirm(
      'Remove Staff Profile',
      'Are you sure you want to remove this staff profile? Note: The auth login account must be deleted separately in the Supabase console.',
      async () => {
        try {
          setDeletingUserId(userId);
          showToast('Removing staff profile...', 'info');
          await dbService.deleteUser(userId);
          setUsers(prev => prev.filter(u => u.id !== userId));
          showToast('Staff profile removed from POS database.', 'success');
        } catch (e) {
          showToast('Failed to remove user profile', 'error');
        } finally {
          setDeletingUserId(null);
        }
      }
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={18} /> Register New Staff
        </button>
      </div>

      {loading ? (
        <div>Loading staff details...</div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>Sl.</th>
                <th>Full Name</th>
                <th>User ID</th>
                <th>Staff Role</th>
                <th>Created At</th>
                <th style={{ width: '120px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                    No staff profiles found. Register profiles using the button above.
                  </td>
                </tr>
              ) : (
                users.map((u, idx) => (
                  <tr key={u.id}>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{u.full_name || 'N/A'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-secondary)' }}>{u.id}</td>
                    <td>
                      <select 
                        className="form-control" 
                        value={u.role || 'cashier'} 
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        style={{ padding: '4px 8px', fontSize: '13px', width: '130px', height: '34px' }}
                      >
                        <option value="cashier">Cashier</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn btn-danger" style={{ padding: '6px 10px' }} onClick={() => handleDeleteUser(u.id)} disabled={deletingUserId === u.id}>
                        {deletingUserId === u.id ? 'Removing...' : <><Trash2 size={14} /> Remove</>}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* REGISTER NEW STAFF MODAL */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 500 }}>
          <div className="card" style={{ width: '90%', maxWidth: '450px' }}>
            <h3 style={{ marginBottom: '16px' }}>Register New Staff Login</h3>
            <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={fullName} 
                  onChange={e => setFullName(e.target.value)} 
                  required 
                  placeholder="e.g. John Doe" 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input 
                  type="email" 
                  className="form-control" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required 
                  placeholder="staff@rajmahal.com" 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Login Password *</label>
                <input 
                  type="password" 
                  className="form-control" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                  placeholder="Min 6 characters" 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select 
                  className="form-control" 
                  value={role} 
                  onChange={e => setRole(e.target.value)}
                >
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                  {formLoading ? 'Creating...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
