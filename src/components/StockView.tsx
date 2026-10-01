import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import type { ProductVariant } from '../store';
import { AlertTriangle, List, ArrowDownUp } from 'lucide-react';
import { Pagination } from './Pagination';

export const StockView: React.FC = () => {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'inventory' | 'ledger'>('inventory');
  const [loading, setLoading] = useState(true);

  // Pagination states
  const [invPage, setInvPage] = useState(1);
  const [invPageSize, setInvPageSize] = useState(10);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(10);

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

  if (loading) return <div style={{ padding: '24px' }}>Loading inventory audit reports...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
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
                </tr>
              </thead>
              <tbody>
                {variants
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
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: isLow ? 'var(--color-danger)' : 'var(--color-success)' }}>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination 
              currentPage={invPage}
              totalItems={variants.length}
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
                    No stock transaction ledger found. Sales and restocks populate this ledger.
                  </td>
                </tr>
              ) : (
                ledger
                  .slice((ledgerPage - 1) * ledgerPageSize, ledgerPage * ledgerPageSize)
                  .map((log: any, idx: number) => {
                  const variant = variants.find(v => v.id === log.variant_id);
                  const isPositive = log.quantity_change > 0;
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
                              Size: {variant.size} | Color: {variant.color}
                            </div>
                          </>
                        ) : (
                          'Unknown Product'
                        )}
                      </td>
                      <td>
                        <span style={{
                          backgroundColor: log.transaction_type === 'PURCHASE' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: log.transaction_type === 'PURCHASE' ? 'var(--color-primary)' : 'var(--color-success)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600
                        }}>
                          {log.transaction_type}
                        </span>
                      </td>
                      <td style={{
                        fontWeight: 'bold',
                        color: isPositive ? 'var(--color-success)' : 'var(--color-danger)'
                      }}>
                        {isPositive ? `+${log.quantity_change}` : log.quantity_change}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                        {log.reference_id ? log.reference_id.toUpperCase().substring(0, 8) : 'N/A'}
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

    </div>
  );
};
