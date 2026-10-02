import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import { Search, FileText, Printer, X, Eye } from 'lucide-react';
import { Pagination } from './Pagination';
import { printThermalReceipt58mm } from './ThermalReceiptModal';

export const SalesListView: React.FC = () => {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
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
    if (!selectedSale) return;
    printThermalReceipt58mm({
      saleId: selectedSale.id,
      saleDate: selectedSale.sale_date,
      items: saleItems.map(item => ({
        productName: item.variant?.product?.name || 'Item',
        size: item.variant?.size,
        color: item.variant?.color,
        barcode: item.variant?.barcode,
        quantity: item.quantity,
        unitPrice: item.unit_price || (item.total_price / (item.quantity || 1)),
        totalPrice: item.total_price
      })),
      subtotal: selectedSale.total_amount,
      discount: selectedSale.discount_amount,
      payableAmount: selectedSale.payable_amount,
      totalReceived: selectedSale.payment_method === 'CASH' ? selectedSale.received_amount : (selectedSale.payment_method === 'DUE' ? 0 : selectedSale.payable_amount),
      changeAmount: selectedSale.change_amount || 0,
      dueAmount: selectedSale.due_amount || 0,
      paymentMethod: selectedSale.payment_method,
      customerPhone: selectedSale.customer_phone || undefined
    });
  };

  // Filter sales
  const filteredSales = sales.filter(s => 
    s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.payment_method.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.customer_phone && s.customer_phone.includes(searchQuery))
  );

  const paginatedSales = filteredSales.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Search Filter bar */}
      <div className="card" style={{ padding: '12px' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search by invoice code, phone number, or payment mode..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            style={{ paddingLeft: '36px', width: '100%', height: '36px' }}
          />
        </div>
      </div>

      {/* Sales Invoices List */}
      {loading ? (
        <div style={{ padding: '16px', fontSize: '13px' }}>Loading completed sales list...</div>
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
                <th style={{ width: '90px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
                    No completed invoices found.
                  </td>
                </tr>
              ) : (
                paginatedSales.map((s, idx) => (
                  <tr key={s.id}>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {(currentPage - 1) * pageSize + idx + 1}
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '12px' }}>{s.id.toUpperCase().substring(0, 8)}</span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{new Date(s.sale_date).toLocaleDateString()}</td>
                    <td style={{ fontWeight: s.customer_phone ? 600 : 'normal', fontSize: '12px', color: s.customer_phone ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {s.customer_phone ? `📞 ${s.customer_phone}` : '-'}
                    </td>
                    <td>
                      <span style={{
                        background: 'var(--bg-primary)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600
                      }}>{s.payment_method}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontSize: '12.5px' }}>৳{s.total_amount.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontSize: '12.5px', color: s.discount_amount > 0 ? 'var(--color-danger)' : 'inherit' }}>
                      ৳{s.discount_amount.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '13px', color: 'var(--color-primary)' }}>
                      ৳{s.payable_amount.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '12.5px', color: 'var(--color-success)' }}>
                      ৳{(s.payable_amount - s.due_amount).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '12.5px', color: s.due_amount > 0 ? 'var(--color-danger)' : 'inherit' }}>
                      {s.due_amount > 0 ? `৳${s.due_amount.toFixed(2)}` : '৳0.00'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn btn-secondary btn-sm" style={{ padding: '0 8px', fontSize: '11.5px' }} onClick={() => handleViewDetails(s)}>
                        <Eye size={12} style={{ marginRight: '3px' }} /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <Pagination 
            currentPage={currentPage}
            totalItems={filteredSales.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
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
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '12px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '380px', maxHeight: '92vh', overflowY: 'auto', backgroundColor: '#ffffff', color: 'black', padding: '18px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <span style={{ fontWeight: 800, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={16} style={{ color: 'var(--color-primary)' }} /> Invoice Details
              </span>
              <button 
                onClick={() => setSelectedSale(null)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Print Area */}
            <div id="receipt-print-area" style={{ flex: 1, overflowY: 'auto', padding: '2px' }}>
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #cbd5e1', paddingBottom: '12px', marginBottom: '12px' }}>
                <h3 style={{ margin: '4px 0', fontSize: '20px', fontWeight: 900, color: 'var(--color-primary)', letterSpacing: '1px', textTransform: 'uppercase' }}>RAJMAHAL</h3>
                <p style={{ fontSize: '10.5px', fontWeight: 700, color: '#475569', letterSpacing: '1.2px', textTransform: 'uppercase', margin: 0 }}>Elegance — Mens Wear</p>
                <p style={{ fontSize: '10px', color: '#94a3b8', margin: '2px 0 0 0' }}>POS Terminal Invoice</p>
              </div>

              <div style={{ fontSize: '11.5px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Invoice ID:</span>
                  <span style={{ fontWeight: 'bold' }}>{selectedSale.id.toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Date/Time:</span>
                  <span>{new Date(selectedSale.sale_date).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Payment Mode:</span>
                  <span style={{ fontWeight: 'bold' }}>{selectedSale.payment_method}</span>
                </div>
                {selectedSale.customer_phone && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Customer Phone:</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{selectedSale.customer_phone}</span>
                  </div>
                )}
              </div>

              {itemsLoading ? (
                <div style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b' }}>Loading transaction items...</div>
              ) : (
                <>
                  {/* Items list */}
                  <div style={{ borderBottom: '1px dashed #cbd5e1', paddingBottom: '10px', marginBottom: '10px' }}>
                    {saleItems.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span>
                          {item.variant?.product?.name || 'Item'} ({item.variant?.size}/{item.variant?.color}) x {item.quantity}
                        </span>
                        <span style={{ fontWeight: 600 }}>৳{item.total_price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Summary math */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12.5px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
                      <span style={{ fontWeight: 600 }}>৳{selectedSale.total_amount.toFixed(2)}</span>
                    </div>
                    {selectedSale.discount_amount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-danger)' }}>
                        <span>Discount:</span>
                        <span style={{ fontWeight: 600 }}>-৳{selectedSale.discount_amount.toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid #e2e8f0', paddingTop: '6px', fontSize: '13.5px', color: 'var(--color-primary)' }}>
                      <span>Total Payable:</span>
                      <span>৳{selectedSale.payable_amount.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Amount Received:</span>
                      <span style={{ fontWeight: 600 }}>৳{(selectedSale.payment_method === 'CASH' ? Math.min(selectedSale.received_amount, selectedSale.payable_amount) : (selectedSale.payment_method === 'DUE' ? 0 : selectedSale.payable_amount)).toFixed(2)}</span>
                    </div>
                    {selectedSale.due_amount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: 'var(--color-danger)', fontSize: '13px' }}>
                        <span>Due Balance:</span>
                        <span>৳{selectedSale.due_amount.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedSale.payment_method === 'CASH' && selectedSale.received_amount > selectedSale.payable_amount && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                          <span>Cash Tendered:</span>
                          <span>৳{selectedSale.received_amount.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-success)', fontWeight: 600 }}>
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
            <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setSelectedSale(null)}>Close</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handlePrint} disabled={itemsLoading}>
                <Printer size={15} /> Print
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
