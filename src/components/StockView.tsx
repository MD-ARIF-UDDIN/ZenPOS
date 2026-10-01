import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import type { ProductVariant } from '../store';
import { useNotificationStore } from '../store';
import { AlertTriangle, List, ArrowDownUp, SlidersHorizontal, Search, X, Check, ArrowRight } from 'lucide-react';
import { Pagination } from './Pagination';

interface StockViewProps {
  onRefreshStats?: () => void;
}

export const StockView: React.FC<StockViewProps> = ({ onRefreshStats }) => {
  const { showToast } = useNotificationStore();
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'inventory' | 'ledger'>('inventory');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination states
  const [invPage, setInvPage] = useState(1);
  const [invPageSize, setInvPageSize] = useState(10);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(10);

  // Manual Stock Adjustment Modal State
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [newStockQty, setNewStockQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('Inventory Audit / Physical Count');
  const [customNote, setCustomNote] = useState('');
  const [savingAdjust, setSavingAdjust] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [varList, ledgerList] = await Promise.all([
        dbService.getVariants(),
        dbService.getStockLedger()
      ]);
      
      setVariants(varList);
      setLedger(ledgerList);
    } catch (e) {
      console.error('Failed to load inventory audits', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const lowStockItems = variants.filter(v => v.stock_quantity <= v.min_stock_level);

  // Filtered variants based on search
  const filteredVariants = variants.filter(v => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.product?.name.toLowerCase().includes(q) ||
      v.sku.toLowerCase().includes(q) ||
      v.barcode?.toLowerCase().includes(q) ||
      v.size?.toLowerCase().includes(q) ||
      v.color?.toLowerCase().includes(q)
    );
  });

  const openAdjustModal = (variant?: ProductVariant) => {
    if (variant) {
      setSelectedVariantId(variant.id);
      setNewStockQty(variant.stock_quantity);
    } else if (variants.length > 0) {
      setSelectedVariantId(variants[0].id);
      setNewStockQty(variants[0].stock_quantity);
    } else {
      setSelectedVariantId('');
      setNewStockQty(0);
    }
    setAdjustReason('Inventory Audit / Physical Count');
    setCustomNote('');
    setShowAdjustModal(true);
  };

  const handleVariantSelectChange = (vId: string) => {
    setSelectedVariantId(vId);
    const found = variants.find(v => v.id === vId);
    if (found) {
      setNewStockQty(found.stock_quantity);
    }
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariantId) {
      showToast('Please select a product variant to adjust.', 'warning');
      return;
    }

    const currentVar = variants.find(v => v.id === selectedVariantId);
    if (!currentVar) return;

    const currentStock = currentVar.stock_quantity;
    const parsedQty = Number(newStockQty);
    if (isNaN(parsedQty) || parsedQty < 0) {
      showToast('Please enter a valid stock quantity (0 or greater).', 'warning');
      return;
    }

    const delta = parsedQty - currentStock;
    const fullNote = customNote.trim() 
      ? `${adjustReason}: ${customNote.trim()}` 
      : adjustReason;

    try {
      setSavingAdjust(true);
      showToast('Updating stock level...', 'info');
      await dbService.adjustStock(selectedVariantId, parsedQty, fullNote);
      await loadData();
      onRefreshStats?.();
      setShowAdjustModal(false);
      showToast(
        `Stock updated! ${currentVar.product?.name} (${currentVar.size}/${currentVar.color}) is now ${parsedQty} units (${delta >= 0 ? '+' : ''}${delta}).`,
        'success'
      );
    } catch (err: any) {
      console.error('Error adjusting stock:', err);
      showToast(err?.message || 'Error updating stock', 'error');
    } finally {
      setSavingAdjust(false);
    }
  };

  const currentSelectedVariant = variants.find(v => v.id === selectedVariantId);
  const qtyDelta = currentSelectedVariant ? Number(newStockQty) - currentSelectedVariant.stock_quantity : 0;

  if (loading) return <div style={{ padding: '24px' }}>Loading inventory audit reports...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      
      {/* Top Header Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, maxWidth: '380px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text"
              className="form-control"
              placeholder="Search product, SKU, barcode..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setInvPage(1); }}
              style={{ paddingLeft: '32px', height: '34px', fontSize: '12.5px' }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            className="btn btn-primary btn-sm"
            onClick={() => openAdjustModal()}
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <SlidersHorizontal size={14} /> Adjust Stock
          </button>
          <button 
            className={`btn btn-sm ${activeTab === 'inventory' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('inventory')}
          >
            <List size={14} /> Inventory Levels
          </button>
          <button 
            className={`btn btn-sm ${activeTab === 'ledger' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('ledger')}
          >
            <ArrowDownUp size={14} /> Stock Ledger
          </button>
        </div>
      </div>

      {activeTab === 'inventory' ? (
        <>
          {/* Low Stock Alerts banner */}
          {lowStockItems.length > 0 && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: 'var(--color-danger)'
            }}>
              <AlertTriangle size={18} />
              <div>
                <strong style={{ display: 'inline-block', fontSize: '13px', fontWeight: 700, marginRight: '6px' }}>
                  {lowStockItems.length === 1 
                    ? '1 item running low on stock!' 
                    : `${lowStockItems.length} items running low on stock!`}
                </strong>
                <span style={{ fontSize: '12px', opacity: 0.9 }}>
                  Restock recommended to prevent stockouts.
                </span>
              </div>
            </div>
          )}

          {/* Master Inventory Grid Table */}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>Sl.</th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Barcode</th>
                  <th>Size / Color</th>
                  <th style={{ textAlign: 'center' }}>Total Restocked</th>
                  <th style={{ textAlign: 'center' }}>Total Sold</th>
                  <th style={{ textAlign: 'center' }}>Current Stock</th>
                  <th style={{ textAlign: 'center' }}>Min Stock</th>
                  <th>Status</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredVariants.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      No matching inventory items found.
                    </td>
                  </tr>
                ) : (
                  filteredVariants
                    .slice((invPage - 1) * invPageSize, invPage * invPageSize)
                    .map((v, idx) => {
                    const isLow = v.stock_quantity <= v.min_stock_level;
                    
                    // Compute sold and restocked quantities from stock_ledger for this variant
                    const variantLedger = ledger.filter(l => l.variant_id === v.id);
                    const totalSold = variantLedger
                      .filter(l => l.transaction_type === 'SALE')
                      .reduce((acc, l) => acc + Math.abs(l.quantity_change), 0);
                    const totalRestocked = variantLedger
                      .filter(l => l.transaction_type === 'PURCHASE')
                      .reduce((acc, l) => acc + l.quantity_change, 0);

                    return (
                      <tr key={v.id}>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                          {(invPage - 1) * invPageSize + idx + 1}
                        </td>
                        <td style={{ fontWeight: 600 }}>{v.product?.name}</td>
                        <td>{v.sku}</td>
                        <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{v.barcode}</td>
                        <td>{v.size} / {v.color}</td>
                        <td style={{ textAlign: 'center', fontWeight: '600', color: 'var(--color-primary)' }}>
                          {totalRestocked}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: '600', color: 'var(--color-warning)' }}>
                          {totalSold}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13.5px', color: isLow ? 'var(--color-danger)' : 'var(--color-success)' }}>
                          {v.stock_quantity}
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{v.min_stock_level}</td>
                        <td>
                          <span style={{
                            backgroundColor: isLow ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: isLow ? 'var(--color-danger)' : 'var(--color-success)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 600
                          }}>
                            {isLow ? 'Low Stock' : 'Good'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openAdjustModal(v)}
                            title="Adjust Stock Manually"
                            style={{ padding: '4px 8px', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                          >
                            <SlidersHorizontal size={12} /> Adjust
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            <Pagination 
              currentPage={invPage}
              totalItems={filteredVariants.length}
              pageSize={invPageSize}
              onPageChange={setInvPage}
              onPageSizeChange={setInvPageSize}
            />
          </div>
        </>
      ) : (
        /* STOCK LEDGER TIMELINE */
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>Sl.</th>
                <th>Date/Time</th>
                <th>Item</th>
                <th>Transaction</th>
                <th>Quantity Change</th>
                <th>Invoice/Ref</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                    No stock transaction ledger found. Sales, restocks, and adjustments populate this ledger.
                  </td>
                </tr>
              ) : (
                ledger
                  .slice((ledgerPage - 1) * ledgerPageSize, ledgerPage * ledgerPageSize)
                  .map((log: any, idx: number) => {
                  const variant = variants.find(v => v.id === log.variant_id);
                  const isPositive = log.quantity_change > 0;
                  
                  let badgeBg = 'rgba(16, 185, 129, 0.15)';
                  let badgeColor = 'var(--color-success)';
                  if (log.transaction_type === 'PURCHASE') {
                    badgeBg = 'rgba(59, 130, 246, 0.15)';
                    badgeColor = 'var(--color-primary)';
                  } else if (log.transaction_type === 'ADJUSTMENT') {
                    badgeBg = 'rgba(147, 51, 234, 0.15)';
                    badgeColor = '#9333ea';
                  }

                  return (
                    <tr key={log.id}>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {(ledgerPage - 1) * ledgerPageSize + idx + 1}
                      </td>
                      <td>{new Date(log.created_at).toLocaleString()}</td>
                      <td>
                        {variant ? (
                          <>
                            <div style={{ fontWeight: 600 }}>{variant.product?.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              Size: {variant.size} | Color: {variant.color} · SKU: {variant.sku}
                            </div>
                          </>
                        ) : (
                          'Unknown Product'
                        )}
                      </td>
                      <td>
                        <span style={{
                          backgroundColor: badgeBg,
                          color: badgeColor,
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700
                        }}>
                          {log.transaction_type}
                        </span>
                      </td>
                      <td style={{
                        fontWeight: 'bold',
                        color: isPositive ? 'var(--color-success)' : (log.quantity_change < 0 ? 'var(--color-danger)' : 'var(--text-muted)')
                      }}>
                        {isPositive ? `+${log.quantity_change}` : log.quantity_change}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                        {log.reference_id ? log.reference_id.toUpperCase().substring(0, 8) : 'MANUAL'}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{log.notes}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <Pagination 
            currentPage={ledgerPage}
            totalItems={ledger.length}
            pageSize={ledgerPageSize}
            onPageChange={setLedgerPage}
            onPageSizeChange={setLedgerPageSize}
          />
        </div>
      )}

      {/* MANUAL STOCK ADJUSTMENT MODAL */}
      {showAdjustModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '12px'
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '520px',
            backgroundColor: '#ffffff',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  background: 'rgba(147, 51, 234, 0.1)',
                  color: '#9333ea',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <SlidersHorizontal size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Manual Stock Adjustment
                  </h3>
                  <p style={{ margin: '1px 0 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                    Update on-hand inventory count and record reason in audit ledger
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowAdjustModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveAdjustment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Variant Selector */}
              <div className="form-group">
                <label className="form-label">Select Product Variant *</label>
                <select 
                  className="form-control"
                  value={selectedVariantId}
                  onChange={e => handleVariantSelectChange(e.target.value)}
                  required
                >
                  {variants.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.product?.name} ({v.size} / {v.color}) — Stock: {v.stock_quantity} (SKU: {v.sku})
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Info Card */}
              {currentSelectedVariant && (
                <div style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                      {currentSelectedVariant.product?.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Size: <strong>{currentSelectedVariant.size}</strong> · Color: <strong>{currentSelectedVariant.color}</strong> · Barcode: <span style={{ fontFamily: 'monospace' }}>{currentSelectedVariant.barcode}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Current Stock</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary)' }}>
                      {currentSelectedVariant.stock_quantity} units
                    </div>
                  </div>
                </div>
              )}

              {/* New Stock Count & Adjustment */}
              <div className="form-group">
                <label className="form-label">New Actual Physical Stock Quantity *</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setNewStockQty(prev => Math.max(0, Number(prev) - 1))}
                    style={{ padding: '0 12px', fontWeight: 700 }}
                  >
                    -1
                  </button>
                  <input 
                    type="number"
                    min="0"
                    className="form-control"
                    value={newStockQty}
                    onChange={e => setNewStockQty(Math.max(0, parseInt(e.target.value) || 0))}
                    required
                    style={{ textAlign: 'center', fontSize: '16px', fontWeight: 700 }}
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setNewStockQty(prev => Number(prev) + 1)}
                    style={{ padding: '0 12px', fontWeight: 700 }}
                  >
                    +1
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => setNewStockQty(prev => Number(prev) + 5)}
                    style={{ padding: '0 10px', fontSize: '11px' }}
                  >
                    +5
                  </button>
                </div>

                {/* Stock Delta Preview */}
                {currentSelectedVariant && (
                  <div style={{
                    marginTop: '8px',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: qtyDelta > 0 
                      ? 'rgba(16, 185, 129, 0.1)' 
                      : (qtyDelta < 0 ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-primary)'),
                    color: qtyDelta > 0 
                      ? 'var(--color-success)' 
                      : (qtyDelta < 0 ? 'var(--color-danger)' : 'var(--text-muted)')
                  }}>
                    <span>Stock Adjustment Delta:</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {currentSelectedVariant.stock_quantity} <ArrowRight size={12} /> {newStockQty} 
                      <strong>({qtyDelta >= 0 ? `+${qtyDelta}` : qtyDelta} units)</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Adjustment Reason */}
              <div className="form-group">
                <label className="form-label">Reason Category *</label>
                <select 
                  className="form-control"
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  required
                >
                  <option value="Inventory Audit / Physical Count">Inventory Audit / Physical Count</option>
                  <option value="Damaged / Broken Goods">Damaged / Broken Goods</option>
                  <option value="Found Stock / Unrecorded Items">Found Stock / Unrecorded Items</option>
                  <option value="Customer Return / Exchange">Customer Return / Exchange</option>
                  <option value="Supplier Return / Defect">Supplier Return / Defect</option>
                  <option value="Internal Use / Display Sample">Internal Use / Display Sample</option>
                  <option value="Correction / Other">Correction / Other</option>
                </select>
              </div>

              {/* Remarks / Custom Note */}
              <div className="form-group">
                <label className="form-label">Additional Remarks (Optional)</label>
                <input 
                  type="text"
                  className="form-control"
                  placeholder="e.g. Recounted shelf B-1, 2 items were misplaced"
                  value={customNote}
                  onChange={e => setCustomNote(e.target.value)}
                />
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowAdjustModal(false)}
                  disabled={savingAdjust}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={savingAdjust}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <Check size={16} /> {savingAdjust ? 'Updating...' : 'Confirm Stock Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
