import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import { Search, FileText, Calendar, Printer, X, Eye } from 'lucide-react';

export const SalesListView: React.FC = () => {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected sale details modal state
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const loadSales = async () => {
    try {
      setLoading(true);
      const list = await dbService.getSales();
      setSales(list);
    } catch (e) {
      console.error('Failed to load sales list', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, []);

  const handleViewDetails = async (sale: any) => {
    setSelectedSale(sale);
    try {
      setItemsLoading(true);
      const items = await dbService.getSaleItems(sale.id);
      setSaleItems(items);
    } catch (e) {
      console.error('Failed to load sale details', e);
    } finally {
      setItemsLoading(false);
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('receipt-print-area');
    if (!printContent) return;
    
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent.innerHTML;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload(); // Reload to restore React state
  };

  // Filter sales
  const filteredSales = sales.filter(s => 
    s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.payment_method.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.customer_phone && s.customer_phone.includes(searchQuery))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      


      {/* Search Filter bar */}
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search by invoice, phone number, or payment method..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '44px', width: '100%' }}
          />
        </div>
      </div>

      {/* Sales Invoices List */}
      {loading ? (
        <div>Loading completed sales list...</div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>Sl.</th>
                <th>Invoice Code</th>
                <th>Time/Date</th>
                <th>Customer Phone</th>
                <th>Payment Mode</th>
                <th style={{ textAlign: 'right' }}>Subtotal</th>
                <th style={{ textAlign: 'right' }}>Discount</th>
                <th style={{ textAlign: 'right' }}>Total Payable</th>
                <th style={{ textAlign: 'right' }}>Paid</th>
                <th style={{ textAlign: 'right' }}>Due</th>
                <th style={{ width: '140px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                    No completed invoices found.
                  </td>
                </tr>
              ) : (
                 filteredSales.map((s, idx) => (
                  <tr key={s.id}>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}</td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{s.id.toUpperCase().substring(0, 8)}</span>
                    </td>
                    <td>{new Date(s.sale_date).toLocaleDateString()}</td>
                    <td style={{ fontWeight: s.customer_phone ? 600 : 'normal', color: s.customer_phone ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {s.customer_phone ? `📞 ${s.customer_phone}` : '-'}
                    </td>
                    <td>
                      <span style={{
                        background: 'var(--bg-primary)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600
                      }}>{s.payment_method}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>৳{s.total_amount.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', color: s.discount_amount > 0 ? 'var(--color-danger)' : 'inherit' }}>
                      ৳{s.discount_amount.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                      ৳{s.payable_amount.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--color-success)' }}>
                      ৳{(s.payable_amount - s.due_amount).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: s.due_amount > 0 ? 'var(--color-danger)' : 'inherit' }}>
                      {s.due_amount > 0 ? `৳${s.due_amount.toFixed(2)}` : '৳0.00'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={() => handleViewDetails(s)}>
                        <Eye size={14} style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline' }} /> Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* DETAILS MODAL */}
      {selectedSale && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '90%', maxWidth: '420px', backgroundColor: 'white', color: 'black', padding: '24px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>
              <span style={{ fontWeight: 700, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={18} style={{ color: 'var(--color-primary)' }} /> Invoice Details
              </span>
              <button 
                onClick={() => setSelectedSale(null)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Print Area */}
            <div id="receipt-print-area" style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #ccc', paddingBottom: '16px', marginBottom: '16px' }}>
                <h3 style={{ margin: '8px 0', fontSize: '28px', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '1px', textTransform: 'uppercase' }}>RAJMAHAL</h3>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#475569', margin: 0 }}>Premium Clothing Store</p>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>POS Terminal Invoice</p>
              </div>

              <div style={{ fontSize: '12px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Invoice ID:</span>
                  <span style={{ fontWeight: 'bold' }}>{selectedSale.id.toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Date/Time:</span>
                  <span>{new Date(selectedSale.sale_date).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Payment Mode:</span>
                  <span style={{ fontWeight: 'bold' }}>{selectedSale.payment_method}</span>
                </div>
                {selectedSale.customer_phone && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Customer Phone:</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{selectedSale.customer_phone}</span>
                  </div>
                )}
              </div>

              {itemsLoading ? (
                <div style={{ textAlign: 'center', padding: '16px', fontSize: '13px', color: '#666' }}>Loading transaction items...</div>
              ) : (
                <>
                  {/* Items list */}
                  <div style={{ borderBottom: '1px dashed #ccc', paddingBottom: '12px', marginBottom: '12px' }}>
                    {saleItems.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                        <span>
                          {item.variant?.product?.name || 'Item'} ({item.variant?.size}/{item.variant?.color}) x {item.quantity}
                        </span>
                        <span>৳{item.total_price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Summary math */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Subtotal:</span>
                      <span>৳{selectedSale.total_amount.toFixed(2)}</span>
                    </div>
                    {selectedSale.discount_amount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'red' }}>
                        <span>Discount:</span>
                        <span>-৳{selectedSale.discount_amount.toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid #eee', paddingTop: '8px' }}>
                      <span>Total Payable:</span>
                      <span>৳{selectedSale.payable_amount.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span>Amount Received:</span>
                      <span>৳{(selectedSale.payment_method === 'CASH' ? Math.min(selectedSale.received_amount, selectedSale.payable_amount) : (selectedSale.payment_method === 'DUE' ? 0 : selectedSale.payable_amount)).toFixed(2)}</span>
                    </div>
                    {selectedSale.due_amount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: 'var(--color-danger)', fontSize: '15px' }}>
                        <span>Due Balance:</span>
                        <span>৳{selectedSale.due_amount.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedSale.payment_method === 'CASH' && selectedSale.received_amount > selectedSale.payable_amount && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
                          <span>Cash Tendered:</span>
                          <span>৳{selectedSale.received_amount.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
                          <span>Change Returned:</span>
                          <span>৳{selectedSale.change_amount.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid #eee', paddingTop: '12px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setSelectedSale(null)}>Close</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handlePrint} disabled={itemsLoading}>
                <Printer size={16} /> Print Receipt
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
