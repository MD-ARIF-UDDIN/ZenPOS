import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import { useNotificationStore } from '../store';
import { Search, Eye, RotateCcw, ArrowLeftRight, Trash2, ShoppingBag, DollarSign } from 'lucide-react';
import { Pagination } from './Pagination';
import { InvoicePrintModal, type InvoiceData } from './InvoicePrintModal';

interface ReturnsListViewProps {
  isRestricted?: boolean;
}

export const ReturnsListView: React.FC<ReturnsListViewProps> = ({ isRestricted = false }) => {
  const { showToast, showConfirm } = useNotificationStore();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PURE_RETURN' | 'EXCHANGE'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selected invoice modal state (View / Print)
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const loadReturnSales = async () => {
    try {
      setLoading(true);
      const allSales = await dbService.getSales();
      // Filter sales that have at least one returned item or a negative/zero net amount with return items
      const returnList = allSales.filter(s => {
        return s.sale_items?.some((si: any) => si.sale_type === 'RETURN' || si.is_returned);
      });
      setSales(returnList);
    } catch (e) {
      console.error('Failed to load return list', e);
      showToast('Failed to load returns list', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReturnSales();
  }, []);

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

  const handleDeleteSale = (sale: any) => {
    const code = sale.id.toUpperCase().substring(0, 8);
    showConfirm(
      'Delete Return / Exchange Invoice',
      `Are you sure you want to permanently delete Return Record #${code}?`,
      async () => {
        try {
          await dbService.deleteSale(sale.id);
          showToast(`Invoice #${code} deleted successfully!`, 'success');
          loadReturnSales();
        } catch (err: any) {
          console.error('Failed to delete sale', err);
          showToast(err.message || 'Failed to delete return invoice', 'error');
        }
      }
    );
  };

  // Classify transactions
  const getSaleType = (s: any) => {
    const returnItems = (s.sale_items || []).filter((si: any) => si.sale_type === 'RETURN' || si.is_returned);
    const saleItems = (s.sale_items || []).filter((si: any) => si.sale_type !== 'RETURN' && !si.is_returned);
    if (returnItems.length > 0 && saleItems.length === 0) return 'PURE_RETURN';
    return 'EXCHANGE';
  };

  // Filtered dataset
  const filteredSales = sales.filter(s => {
    const type = getSaleType(s);
    if (filterType !== 'ALL' && type !== filterType) return false;

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

  // Calculate KPIs
  const totalReturnTxCount = sales.length;
  let totalReturnedQty = 0;
  let totalRefundValue = 0;

  sales.forEach(s => {
    (s.sale_items || []).forEach((si: any) => {
      if (si.sale_type === 'RETURN' || si.is_returned) {
        totalReturnedQty += Number(si.quantity || 0);
        totalRefundValue += Math.abs(Number(si.total_price || 0));
      }
    });
  });

  const paginatedSales = filteredSales.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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

      {/* KPI Top Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
        <div className="card" style={{ padding: '12px 16px', borderLeft: '4px solid #dc2626' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title" style={{ color: '#991b1b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Returns & Exchanges
              </div>
              <div className="card-value" style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626' }}>
                {totalReturnTxCount}
              </div>
            </div>
            <span style={{ background: '#fee2e2', color: '#dc2626', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
              <RotateCcw size={18} />
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 16px', borderLeft: '4px solid #ea580c' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title" style={{ color: '#9a3412', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                Returned Product Units
              </div>
              <div className="card-value" style={{ fontSize: '20px', fontWeight: 800, color: '#ea580c' }}>
                {totalReturnedQty} pcs
              </div>
            </div>
            <span style={{ background: '#ffedd5', color: '#ea580c', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
              <ShoppingBag size={18} />
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 16px', borderLeft: '4px solid #b91c1c' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title" style={{ color: '#881337', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Return Credit / Refunded
              </div>
              <div className="card-value" style={{ fontSize: '20px', fontWeight: 800, color: '#b91c1c' }}>
                ৳{totalRefundValue.toFixed(2)}
              </div>
            </div>
            <span style={{ background: '#ffe4e6', color: '#b91c1c', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
              <DollarSign size={18} />
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card" style={{ padding: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search return by invoice code, customer phone, product name, or barcode..."
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
            onClick={() => { setFilterType('ALL'); setCurrentPage(1); }}
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '4px',
              border: 'none',
              background: filterType === 'ALL' ? 'var(--color-primary)' : 'transparent',
              color: filterType === 'ALL' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            All Returns ({sales.length})
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => { setFilterType('PURE_RETURN'); setCurrentPage(1); }}
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '4px',
              border: 'none',
              background: filterType === 'PURE_RETURN' ? '#dc2626' : 'transparent',
              color: filterType === 'PURE_RETURN' ? '#fff' : '#b91c1c'
            }}
          >
            Pure Returns / Refunds
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => { setFilterType('EXCHANGE'); setCurrentPage(1); }}
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '4px',
              border: 'none',
              background: filterType === 'EXCHANGE' ? '#2563eb' : 'transparent',
              color: filterType === 'EXCHANGE' ? '#fff' : '#1d4ed8'
            }}
          >
            Exchanges
          </button>
        </div>
      </div>

      {/* Returns Invoices List Table */}
      {loading ? (
        <div style={{ padding: '24px', fontSize: '13px', textAlign: 'center' }}>Loading returns & exchange records...</div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>Sl.</th>
                <th>Invoice Code</th>
                <th>Time/Date</th>
                <th>Customer Phone</th>
                <th>Type</th>
                <th>Returned Products</th>
                <th>Replacement Products</th>
                <th style={{ textAlign: 'right' }}>Return Credit</th>
                <th style={{ textAlign: 'right' }}>Net Settlement</th>
                <th style={{ textAlign: 'center' }}>Payment Mode</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    No return or exchange records found matching your query.
                  </td>
                </tr>
              ) : (
                paginatedSales.map((s, idx) => {
                  const type = getSaleType(s);
                  const returnItems = (s.sale_items || []).filter((si: any) => si.sale_type === 'RETURN' || si.is_returned);
                  const newItems = (s.sale_items || []).filter((si: any) => si.sale_type !== 'RETURN' && !si.is_returned);
                  
                  const returnCredit = returnItems.reduce((acc: number, si: any) => acc + Math.abs(Number(si.total_price || 0)), 0);
                  const isRefund = s.payable_amount < 0;

                  return (
                    <tr key={s.id}>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '12px', color: 'var(--color-primary)' }}>
                          #{s.id.toUpperCase().substring(0, 8)}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {new Date(s.sale_date).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td style={{ fontWeight: s.customer_phone ? 600 : 'normal', fontSize: '12px', color: s.customer_phone ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {s.customer_phone ? `📞 ${s.customer_phone}` : '-'}
                      </td>
                      <td>
                        {type === 'PURE_RETURN' ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            background: '#fee2e2',
                            color: '#dc2626',
                            fontSize: '10.5px',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            whiteSpace: 'nowrap'
                          }}>
                            <RotateCcw size={10} /> PURE RETURN
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            background: '#eff6ff',
                            color: '#2563eb',
                            fontSize: '10.5px',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            whiteSpace: 'nowrap'
                          }}>
                            <ArrowLeftRight size={10} /> EXCHANGE
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {returnItems.map((si: any, rIdx: number) => (
                            <div key={rIdx} style={{ fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ color: '#dc2626', fontWeight: 700 }}>•</span>
                              <strong>{si.variant?.product?.name || 'Product'}</strong>
                              <span style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>
                                ({[si.variant?.size, si.variant?.color].filter(Boolean).join('/')})
                              </span>
                              <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '0 4px', borderRadius: '3px', fontWeight: 700, fontSize: '10px' }}>
                                x{si.quantity}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {newItems.length === 0 ? (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>None (Cash Refund)</span>
                          ) : (
                            newItems.map((si: any, nIdx: number) => (
                              <div key={nIdx} style={{ fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ color: '#2563eb', fontWeight: 700 }}>+</span>
                                <strong>{si.variant?.product?.name || 'Product'}</strong>
                                <span style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>
                                  ({[si.variant?.size, si.variant?.color].filter(Boolean).join('/')})
                                </span>
                                <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '0 4px', borderRadius: '3px', fontWeight: 700, fontSize: '10px' }}>
                                  x{si.quantity}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#dc2626', fontSize: '12.5px' }}>
                        -৳{returnCredit.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '13px', color: isRefund ? '#dc2626' : Number(s.payable_amount) === 0 ? '#059669' : 'var(--color-primary)' }}>
                        {isRefund ? `Refund: ৳${Math.abs(Number(s.payable_amount)).toFixed(2)}` : Number(s.payable_amount) === 0 ? 'Even (৳0.00)' : `Paid: ৳${Number(s.payable_amount).toFixed(2)}`}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '4px',
                          background: '#f1f5f9',
                          color: '#475569',
                          textTransform: 'uppercase'
                        }}>
                          {s.payment_method || 'CASH'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleViewDetails(s)}
                            title="View / Print Return Invoice"
                            style={{ height: '26px', padding: '0 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                          >
                            <Eye size={12} /> View
                          </button>
                          {!isRestricted && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteSale(s)}
                              title="Delete Record"
                              style={{ width: '26px', height: '26px', padding: 0 }}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
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

      {/* Invoice Details & Print Modal */}
      {selectedSale && !itemsLoading && invoiceData && (
        <InvoicePrintModal
          data={invoiceData}
          onClose={() => {
            setSelectedSale(null);
            setSaleItems([]);
          }}
        />
      )}

    </div>
  );
};
