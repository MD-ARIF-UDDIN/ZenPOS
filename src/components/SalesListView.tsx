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
  const filteredSales = baseSales.filter(s => 
    s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.payment_method.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.customer_phone && s.customer_phone.includes(searchQuery))
  );

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
      unitPrice: item.unit_price || (item.total_price / (item.quantity || 1)),
      totalPrice: item.total_price,
      saleType: item.sale_type || 'SALE',
      returnDate: item.return_date || null
    }))
  } : null;

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
                <th style={{ width: '180px', textAlign: 'center' }}>Actions</th>
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0 6px', fontSize: '11.5px', height: '26px' }}
                          onClick={() => handleViewDetails(s)}
                          title="View / Print Invoice"
                        >
                          <Eye size={12} style={{ marginRight: '2px' }} /> View
                        </button>

                        {!isRestricted && (
                          <>
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
                          </>
                        )}
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


