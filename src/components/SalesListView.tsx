import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import { useNotificationStore } from '../store';
import { Search, Eye, Edit2, Trash2 } from 'lucide-react';
import { Pagination } from './Pagination';
import { InvoicePrintModal, type InvoiceData } from './InvoicePrintModal';
import { EditSaleModal } from './EditSaleModal';

interface SalesListViewProps {
  isRestricted?: boolean;
}

export const SalesListView: React.FC<SalesListViewProps> = ({ isRestricted = false }) => {
  const { showToast, showConfirm } = useNotificationStore();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'SALES' | 'RETURNS'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Selected sale details modal state (View / Print)
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Edit sale modal state
  const [editingSale, setEditingSale] = useState<any | null>(null);
  const [editingSaleItems, setEditingSaleItems] = useState<any[]>([]);
  const [editLoading, setEditLoading] = useState(false);

  const loadSales = async () => {
    try {
      setLoading(true);
      const list = await dbService.getSales(false, isRestricted ? 5 : undefined);
      setSales(isRestricted ? list.slice(0, 5) : list);
    } catch (e) {
      console.error('Failed to load sales list', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, [isRestricted]);

  const handleViewDetails = async (sale: any) => {
    setSelectedSale(sale);
    try {
      setItemsLoading(true);
      const items = await dbService.getSaleItems(sale.id);
      setSaleItems(items);
    } catch (e) {
      console.error('Failed to load sale details', e);
      showToast('Failed to load sale details', 'error');
    } finally {
      setItemsLoading(false);
    }
  };

  const handleStartEdit = async (sale: any) => {
    try {
      setEditLoading(true);
      const items = await dbService.getSaleItems(sale.id);
      setEditingSaleItems(items);
      setEditingSale(sale);
    } catch (e) {
      console.error('Failed to load sale items for editing', e);
      showToast('Failed to load sale items for editing', 'error');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteSale = (sale: any) => {
    const code = sale.id.toUpperCase().substring(0, 8);
    showConfirm(
      'Delete Sale Invoice',
      `Are you sure you want to permanently delete Invoice #${code}? All sold products in this invoice will be automatically returned to inventory stock.`,
      async () => {
        try {
          await dbService.deleteSale(sale.id);
          showToast(`Invoice #${code} deleted and products restocked successfully!`, 'success');
          loadSales();
        } catch (err: any) {
          console.error('Failed to delete sale', err);
          showToast(err.message || 'Failed to delete sale invoice', 'error');
        }
      }
    );
  };

  // Filter sales
  const baseSales = isRestricted ? sales.slice(0, 5) : sales;
  const filteredSales = baseSales.filter(s => {
    const hasReturn = s.sale_items?.some((si: any) => si.sale_type === 'RETURN' || si.is_returned);
    if (filterTab === 'RETURNS' && !hasReturn) return false;
    if (filterTab === 'SALES' && hasReturn) return false;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const matchesId = s.id.toLowerCase().includes(q);
    const matchesMethod = (s.payment_method || '').toLowerCase().includes(q);
    const matchesPhone = s.customer_phone && s.customer_phone.includes(q);
    const matchesBarcode = s.sale_items?.some((si: any) => 
      si.variant?.barcode?.toLowerCase().includes(q) ||
      si.variant?.sku?.toLowerCase().includes(q) ||
      si.variant?.product?.name?.toLowerCase().includes(q)
    );
    return matchesId || matchesMethod || matchesPhone || matchesBarcode;
  });

  const paginatedSales = isRestricted
    ? filteredSales.slice(0, 5)
    : filteredSales.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const invoiceData: InvoiceData | null = selectedSale ? {
    invoiceId: selectedSale.id,
    saleDate: selectedSale.sale_date,
    paymentMethod: selectedSale.payment_method,
    customerPhone: selectedSale.customer_phone,
    totalAmount: selectedSale.total_amount,
    discountAmount: selectedSale.discount_amount || 0,
    payableAmount: selectedSale.payable_amount,
    receivedAmount: selectedSale.received_amount || selectedSale.payable_amount,
    dueAmount: selectedSale.due_amount || 0,
    changeAmount: selectedSale.change_amount || 0,
    items: saleItems.map(item => ({
      id: item.id,
      name: item.variant?.product?.name || 'Item',
      size: item.variant?.size,
      color: item.variant?.color,
      sku: item.variant?.sku,
      barcode: item.variant?.barcode,
      code: item.variant?.sku || item.variant?.barcode,
      quantity: item.quantity,
      unitPrice: item.unit_price || (Math.abs(item.total_price) / (item.quantity || 1)),
      totalPrice: item.total_price,
      saleType: item.sale_type || (item.is_returned ? 'RETURN' : 'SALE'),
      returnDate: item.return_date || null
    }))
  } : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Search & Submenu Filter bar */}
      <div className="card" style={{ padding: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search by invoice code, barcode, product, phone number, or payment mode..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            style={{ paddingLeft: '36px', width: '100%', height: '36px' }}
          />
        </div>

        {/* Submenu Filter Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => { setFilterTab('ALL'); setCurrentPage(1); }}
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '4px',
              border: 'none',
              background: filterTab === 'ALL' ? 'var(--color-primary)' : 'transparent',
              color: filterTab === 'ALL' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            All Invoices
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => { setFilterTab('SALES'); setCurrentPage(1); }}
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '4px',
              border: 'none',
              background: filterTab === 'SALES' ? 'var(--color-primary)' : 'transparent',
              color: filterTab === 'SALES' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            Sales Only
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => { setFilterTab('RETURNS'); setCurrentPage(1); }}
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '4px',
              border: 'none',
              background: filterTab === 'RETURNS' ? '#dc2626' : 'transparent',
              color: filterTab === 'RETURNS' ? '#fff' : '#b91c1c'
            }}
          >
            Returns & Exchanges Only
          </button>
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
                <th>Product Code</th>
                <th>Barcode</th>
                <th>Payment Mode</th>
                <th style={{ textAlign: 'right' }}>Subtotal</th>
                <th style={{ textAlign: 'right' }}>Discount</th>
                <th style={{ textAlign: 'right' }}>Total Payable</th>
                <th style={{ textAlign: 'right' }}>Paid</th>
                <th style={{ textAlign: 'right' }}>Due</th>
                <th style={{ width: '180px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={13} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                        {s.sale_items && s.sale_items.length > 0 ? (
                          s.sale_items.map((item: any, itemIdx: number) => {
                            const sku = item.variant?.sku || '-';
                            const productName = item.variant?.product?.name || 'Product';
                            const details = [item.variant?.size, item.variant?.color].filter(Boolean).join(' / ');
                            return (
                              <span
                                key={itemIdx}
                                style={{
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  color: 'var(--text-primary)',
                                  background: 'var(--bg-primary)',
                                  border: '1px solid var(--border-color)',
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  whiteSpace: 'nowrap'
                                }}
                                title={`${productName} ${details ? `(${details})` : ''} - SKU: ${sku}`}
                              >
                                {sku}
                              </span>
                            );
                          })
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>-</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                        {s.sale_items && s.sale_items.length > 0 ? (
                          s.sale_items.map((item: any, itemIdx: number) => {
                            const barcode = item.variant?.barcode || '-';
                            const productName = item.variant?.product?.name || 'Product';
                            const details = [item.variant?.size, item.variant?.color].filter(Boolean).join(' / ');
                            return (
                              <span
                                key={itemIdx}
                                style={{
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  color: 'var(--text-primary)',
                                  background: 'var(--bg-primary)',
                                  border: '1px solid var(--border-color)',
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  whiteSpace: 'nowrap'
                                }}
                                title={`${productName} ${details ? `(${details})` : ''} - Qty: ${item.quantity || 1}`}
                              >
                                {barcode}
                              </span>
                            );
                          })
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>-</span>
                        )}
                      </div>
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0 6px', fontSize: '11.5px', height: '26px' }}
                          onClick={() => handleViewDetails(s)}
                          title="View / Print Invoice"
                        >
                          <Eye size={12} style={{ marginRight: '2px' }} /> View
                        </button>

                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0 6px', fontSize: '11.5px', height: '26px', color: 'var(--color-primary)' }}
                          onClick={() => handleStartEdit(s)}
                          disabled={editLoading}
                          title="Edit Sale and Adjust Stock"
                        >
                          <Edit2 size={12} style={{ marginRight: '2px' }} /> Edit
                        </button>

                        <button
                          className="btn btn-sm"
                          style={{
                            padding: '0 6px',
                            fontSize: '11.5px',
                            height: '26px',
                            backgroundColor: '#fee2e2',
                            color: 'var(--color-danger)',
                            border: '1px solid #fecaca',
                          }}
                          onClick={() => handleDeleteSale(s)}
                          title="Delete Invoice and Restock Items"
                        >
                          <Trash2 size={12} style={{ marginRight: '2px' }} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {!isRestricted && (
            <Pagination 
              currentPage={currentPage}
              totalItems={filteredSales.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </div>
      )}

      {/* 58mm THERMAL RECEIPT / INVOICE MODAL */}
      {selectedSale && !itemsLoading && invoiceData && (
        <InvoicePrintModal
          data={invoiceData}
          onClose={() => {
            setSelectedSale(null);
            setSaleItems([]);
          }}
        />
      )}

      {/* EDIT SALE MODAL */}
      {editingSale && (
        <EditSaleModal
          sale={editingSale}
          initialItems={editingSaleItems}
          onClose={() => {
            setEditingSale(null);
            setEditingSaleItems([]);
          }}
          onSuccess={() => {
            loadSales();
          }}
        />
      )}

    </div>
  );
};


