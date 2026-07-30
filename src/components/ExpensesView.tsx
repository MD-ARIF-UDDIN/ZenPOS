import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import { useNotificationStore } from '../store';
import { Plus, Trash2, AlertCircle, Calendar, Receipt } from 'lucide-react';

interface ExpensesViewProps {
  onRefreshStats: () => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({ onRefreshStats }) => {
  const { showToast, showConfirm } = useNotificationStore();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [category, setCategory] = useState('Utilities');
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState('');

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const list = await dbService.getExpenses();
      setExpenses(list);
    } catch (e) {
      console.error('Failed to load expenses list', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      showToast('Please enter a valid amount.', 'warning');
      return;
    }

    try {
      setSaving(true);
      showToast('Saving expense...', 'info');
      await dbService.addExpense(category, amount, description);
      setShowAddModal(false);
      setCategory('Utilities');
      setAmount(0);
      setDescription('');
      await loadExpenses();
      onRefreshStats();
      showToast('Expense logged successfully!', 'success');
    } catch (err) {
      showToast('Error logging expense.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = (id: string) => {
    showConfirm(
      'Delete Expense Record',
      'Are you sure you want to delete this expense record? This action cannot be undone.',
      async () => {
        try {
          setDeletingId(id);
          showToast('Deleting expense...', 'info');
          await dbService.deleteExpense(id);
          await loadExpenses();
          onRefreshStats();
          showToast('Expense record deleted.', 'success');
        } catch (err) {
          showToast('Error deleting expense', 'error');
        } finally {
          setDeletingId(null);
        }
      }
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={18} /> Log New Expense
        </button>
      </div>

      {loading ? (
        <div>Loading expense ledger...</div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="desktop-cart-table table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>Sl.</th>
                  <th>Expense Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                      No expenses logged yet.
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp, idx) => (
                    <tr key={exp.id}>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}</td>
                      <td>{new Date(exp.expense_date).toLocaleDateString()}</td>
                      <td>
                        <span style={{
                          background: 'rgba(239, 68, 68, 0.08)',
                          color: 'var(--color-danger)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 600
                        }}>{exp.category}</span>
                      </td>
                      <td style={{ color: exp.description ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {exp.description || 'No description provided'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--color-danger)' }}>
                        ৳{exp.amount.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn btn-danger" style={{ padding: '6px 10px' }} onClick={() => handleDeleteExpense(exp.id)} disabled={deletingId === exp.id}>
                          {deletingId === exp.id ? 'Removing...' : <><Trash2 size={14} /> Remove</>}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="mobile-cart-list" style={{ flexDirection: 'column', gap: '12px' }}>
            {expenses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                No expenses logged yet.
              </div>
            ) : (
              expenses.map((exp) => (
                <div className="card" key={exp.id} style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#fff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      color: 'var(--color-danger)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 700
                    }}>{exp.category}</span>
                    <button className="btn btn-danger" style={{ padding: '4px 6px', borderRadius: '4px' }} onClick={() => handleDeleteExpense(exp.id)} disabled={deletingId === exp.id}>
                      {deletingId === exp.id ? '...' : <Trash2 size={12} />}
                    </button>
                  </div>
                  
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {exp.description || 'No description provided'}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef2f2', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}>
                    <span>Date: <span style={{ fontWeight: 600 }}>{new Date(exp.expense_date).toLocaleDateString()}</span></span>
                    <span style={{ fontWeight: 800, color: 'var(--color-danger)' }}>৳{exp.amount.toFixed(2)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* LOG EXPENSE MODAL */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 500 }}>
          <div className="card" style={{ width: '90%', maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '16px' }}>Log Business Expense</h3>
            <form onSubmit={handleCreateExpense} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div className="form-group">
                <label className="form-label">Expense Category *</label>
                <select 
                  className="form-control" 
                  value={category} 
                  onChange={e => setCategory(e.target.value)}
                  required
                >
                  <option value="Utilities">Utilities (Electricity, Internet, Water)</option>
                  <option value="Rent">Rent (Shop/Warehouse)</option>
                  <option value="Salary">Staff Salaries</option>
                  <option value="Food & Tea">Food, Tea & Entertainment</option>
                  <option value="Packaging">Packaging Material</option>
                  <option value="Marketing">Marketing & Ads</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Amount (৳) *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-control" 
                  value={amount || ''} 
                  onChange={e => setAmount(Number(e.target.value))} 
                  required 
                  placeholder="0.00" 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description / Remarks</label>
                <textarea 
                  className="form-control" 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  placeholder="Details of the expense..." 
                  rows={3} 
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Logging...' : 'Log Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
