import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import { useNotificationStore } from '../store';
import { Search, Clock, CheckCircle2, AlertCircle, RefreshCw, Phone, ShieldAlert, Check, DollarSign, X, FileDown } from 'lucide-react';
import { Pagination } from './Pagination';
import { exportTableToPdf } from '../utils/pdfExport';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import { isAdminRole } from '../roleUtils';

type RentalFilter = 'all' | 'active' | 'overdue' | 'returned';

interface RentalsViewProps {
  onRefreshStats?: () => void;
  userRole?: string;
}

export const RentalsView: React.FC<RentalsViewProps> = ({ onRefreshStats, userRole }) => {
  const { showToast, showConfirm } = useNotificationStore();
  const [rentals, setRentals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<RentalFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [actionLoading, setActionLoading] = useState(false);

  // Return & Payment Collection Modal state
  const [returnModalItem, setReturnModalItem] = useState<any | null>(null);
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');

  const loadRentals = async () => {
    try {
      setLoading(true);
      const data = await dbService.getRentals();
      setRentals(data);
    } catch (e) {
      console.error('Failed to load rentals', e);
      showToast('Failed to load rentals list', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRentals();
  }, []);

  const isOverdue = (returnDateStr?: string | null, isReturned?: boolean) => {
    if (isReturned || !returnDateStr) return false;
    const returnDate = new Date(returnDateStr + 'T23:59:59');
    const now = new Date();
    return returnDate < now;
  };

  const handleOpenReturnModal = (item: any) => {
    const due = Number(item.sale?.due_amount || 0);
    if (due > 0) {
      setReturnModalItem(item);
      setCollectAmount(due);
      setPaymentMethod('CASH');
    } else {
      const productName = item.variant?.product?.name || 'Rented Item';
      const sku = item.variant?.sku || item.variant?.barcode || '';
      const currentStock = item.variant?.stock_quantity ?? 0;

      showConfirm(
        'Confirm Rental Return',
        `Confirm return for "${productName} (${sku})"? This will complete the rental and automatically restock 1 unit to inventory.`,
        async () => {
          try {
            setActionLoading(true);
            await dbService.markRentalReturned(item.id, item.variant_id, currentStock);
            showToast(`"${productName}" restocked and marked as returned successfully!`, 'success');
            await loadRentals();
            onRefreshStats?.();
          } catch (err: any) {
            console.error(err);
            showToast(err.message || 'Failed to mark rental as returned', 'error');
          } finally {
            setActionLoading(false);
          }
        }
      );
    }
  };

  const handleProcessReturnWithPayment = async (collectDue: boolean) => {
    if (!returnModalItem) return;
    const item = returnModalItem;
    const currentStock = item.variant?.stock_quantity ?? 0;
    const amountToCollect = collectDue ? Math.min(Number(collectAmount || 0), Number(item.sale?.due_amount || 0)) : 0;

    try {
      setActionLoading(true);
      await dbService.markRentalReturned(
        item.id,
        item.variant_id,
        currentStock,
        amountToCollect > 0 ? {
          saleId: item.sale_id,
          collectAmount: amountToCollect,
          paymentMethod
        } : undefined
      );

      const productName = item.variant?.product?.name || 'Item';
      if (amountToCollect > 0) {
        showToast(`"${productName}" returned & collected ৳${amountToCollect.toFixed(2)} successfully!`, 'success');
      } else {
        showToast(`"${productName}" restocked and marked as returned!`, 'success');
      }

      setReturnModalItem(null);
      await loadRentals();
      onRefreshStats?.();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to process return', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // KPI Calculations
  const totalRentalsCount = rentals.length;
  const activeRentalsCount = rentals.filter(r => !r.is_returned).length;
  const overdueCount = rentals.filter(r => isOverdue(r.return_date, r.is_returned)).length;
  
  // Calculate unique sales due to avoid duplicate addition for multi-item invoices
  const seenSaleIds = new Set<string>();
  const totalPendingDue = rentals.reduce((acc, r) => {
    if (r.sale && !seenSaleIds.has(r.sale_id)) {
      seenSaleIds.add(r.sale_id);
      return acc + Number(r.sale.due_amount || 0);
    }
    return acc;
  }, 0);

  const totalRentalRevenue = rentals.reduce((acc, r) => acc + Number(r.total_price || 0), 0);

  // Filter & Search Logic
  const filteredRentals = rentals.filter(item => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      item.variant?.product?.name?.toLowerCase().includes(q) ||
      item.variant?.sku?.toLowerCase().includes(q) ||
      item.variant?.barcode?.toLowerCase().includes(q) ||
      item.sale?.customer_phone?.includes(q) ||
      item.sale?.id?.toLowerCase().includes(q)
    );

    if (!matchesSearch) return false;

    const overdue = isOverdue(item.return_date, item.is_returned);

    if (filter === 'active') return !item.is_returned;
    if (filter === 'overdue') return overdue;
    if (filter === 'returned') return !!item.is_returned;
    return true;
  });

  const handleDownloadPdf = () => {
    exportTableToPdf({
      moduleName: 'Rentals',
      title: 'Rentals & Bookings Ledger Report',
      subtitle: `Status Filter: ${filter.toUpperCase()}`,
      summaryCards: [
        { label: 'Total Rentals', value: String(totalRentalsCount) },
        { label: 'Currently On Rent', value: String(activeRentalsCount) },
        { label: 'Overdue Items', value: String(overdueCount) },
        { label: 'Pending Due', value: `৳${totalPendingDue.toFixed(2)}` },
        { label: 'Rental Revenue', value: `৳${totalRentalRevenue.toFixed(2)}` }
      ],
      columns: [
        { header: 'Invoice Code', key: 'sale', format: (_, row) => row.sale?.invoice_code || '-' },
        { header: 'Customer Phone', key: 'sale', format: (_, row) => row.sale?.customer_phone || 'Walk-in' },
        { header: 'Product Item', key: 'variant', format: (_, row) => row.variant?.product?.name || '-' },
        { header: 'SKU / Barcode', key: 'variant', format: (_, row) => row.variant?.sku || row.variant?.barcode || '-' },
        { header: 'Rental Date', key: 'sale', format: (_, row) => formatDateDDMMYYYY(row.sale?.sale_date) },
        { header: 'Return Deadline', key: 'return_date', format: (v) => formatDateDDMMYYYY(v) },
        { header: 'Rent Fee', key: 'unit_price', align: 'right', format: (v, row) => `৳${((row.quantity || 1) * Number(v || 0)).toFixed(2)}` },
        { header: 'Pending Due', key: 'sale', align: 'right', format: (_, row) => `৳${Number(row.sale?.due_amount || 0).toFixed(2)}` },
        { header: 'Status', key: 'is_returned', align: 'center', format: (v, row) => (v ? 'Returned' : isOverdue(row.return_date, row.is_returned) ? 'OVERDUE' : 'Active On Rent') }
      ],
      data: filteredRentals
    });
  };

  const paginatedRentals = filteredRentals.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title">Total Rentals</div>
              <div className="card-value">{totalRentalsCount}</div>
            </div>
            <span style={{ background: 'rgba(11, 37, 69, 0.08)', color: 'var(--color-primary)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
              <Clock size={18} />
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title">Currently On Rent</div>
              <div className="card-value" style={{ color: 'var(--color-info)' }}>{activeRentalsCount}</div>
            </div>
            <span style={{ background: 'rgba(2, 132, 199, 0.08)', color: 'var(--color-info)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
              <AlertCircle size={18} />
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title">Overdue Items</div>
              <div className="card-value" style={{ color: overdueCount > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                {overdueCount}
              </div>
            </div>
            <span style={{ background: overdueCount > 0 ? 'rgba(225, 29, 72, 0.08)' : 'rgba(148, 163, 184, 0.08)', color: overdueCount > 0 ? 'var(--color-danger)' : 'var(--text-muted)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
              <ShieldAlert size={18} />
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title">Pending Rental Due</div>
              <div className="card-value" style={{ color: totalPendingDue > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                ৳{totalPendingDue.toFixed(2)}
              </div>
            </div>
            <span style={{ background: totalPendingDue > 0 ? 'rgba(225, 29, 72, 0.08)' : 'rgba(5, 150, 105, 0.08)', color: totalPendingDue > 0 ? 'var(--color-danger)' : 'var(--color-success)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
              <DollarSign size={18} />
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title">Rental Revenue</div>
              <div className="card-value" style={{ color: 'var(--color-success)' }}>
                ৳{totalRentalRevenue.toFixed(2)}
              </div>
            </div>
            <span style={{ background: 'rgba(5, 150, 105, 0.08)', color: 'var(--color-success)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
              <CheckCircle2 size={18} />
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search by product, SKU, barcode, customer phone, or invoice..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            style={{ paddingLeft: '36px', width: '100%', height: '36px' }}
          />
        </div>

        {/* Tab Filters */}
        <div style={{
          display: 'flex',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '3px',
          gap: '3px'
        }}>
          {(['all', 'active', 'overdue', 'returned'] as const).map(option => (
            <button
              key={option}
              className="btn btn-sm"
              onClick={() => {
                setFilter(option);
                setCurrentPage(1);
              }}
              style={{
                padding: '4px 10px',
                fontSize: '11.5px',
                borderRadius: '4px',
                background: filter === option ? 'var(--color-primary)' : 'transparent',
                color: filter === option ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 700,
                boxShadow: filter === option ? 'var(--shadow-xs)' : 'none',
                height: '28px'
              }}
            >
              <span style={{ textTransform: 'capitalize' }}>
                {option === 'all' ? 'All Rentals' : option === 'active' ? 'On Rent' : option}
              </span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isAdminRole(userRole) && (
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="btn btn-secondary btn-sm"
              style={{ height: '36px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700 }}
              title="Download Rentals PDF"
            >
              <FileDown size={14} /> Download PDF
            </button>
          )}

          <button 
            className="btn btn-secondary btn-sm" 
            onClick={loadRentals}
            title="Reload rentals list"
            style={{ height: '36px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Rentals Table */}
      {loading ? (
        <div style={{ padding: '24px', fontSize: '13px' }}>Loading rentals ledger...</div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>Sl.</th>
                <th>Invoice</th>
                <th>Rented Product</th>
                <th>Product Code</th>
                <th>Barcode</th>
                <th>Customer Phone</th>
                <th>Rent Date</th>
                <th>Expected Return</th>
                <th style={{ textAlign: 'right' }}>Rent Fee</th>
                <th style={{ textAlign: 'right' }}>Discount</th>
                <th style={{ textAlign: 'right' }}>Paid</th>
                <th style={{ textAlign: 'right' }}>Due</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ width: '130px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRentals.length === 0 ? (
                <tr>
                  <td colSpan={14} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
                    No rental items found for the selected filter.
                  </td>
                </tr>
              ) : (
                paginatedRentals.map((r, idx) => {
                  const overdue = isOverdue(r.return_date, r.is_returned);
                  const isReturned = !!r.is_returned;
                  const productName = r.variant?.product?.name || 'Unknown Product';
                  const sku = r.variant?.sku || '-';
                  const barcode = r.variant?.barcode || '-';
                  const sizeColor = [r.variant?.size, r.variant?.color].filter(Boolean).join(' / ');
                  const rentFee = Number(r.total_price || 0);
                  const discount = Number(r.sale?.discount_amount || 0);
                  const paid = Number(r.sale?.received_amount || 0);
                  const due = Number(r.sale?.due_amount || 0);

                  return (
                    <tr key={r.id}>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {r.sale?.invoice_code || (r.sale?.id ? r.sale.id.toUpperCase().substring(0, 8) : '-')}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--text-primary)' }}>
                          {productName}
                        </div>
                        {sizeColor && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {sizeColor}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          whiteSpace: 'nowrap'
                        }}>
                          {sku}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          whiteSpace: 'nowrap'
                        }}>
                          {barcode}
                        </span>
                      </td>
                      <td>
                        {r.sale?.customer_phone ? (
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Phone size={11} style={{ color: 'var(--text-muted)' }} />
                            {r.sale.customer_phone}
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {formatDateDDMMYYYY(r.sale?.sale_date)}
                      </td>
                      <td>
                        {r.return_date ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '12px', fontWeight: overdue ? 700 : 500, color: overdue ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                              {formatDateDDMMYYYY(r.return_date)}
                            </span>
                            {overdue && (
                              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-danger)', background: '#fee2e2', padding: '1px 5px', borderRadius: '3px', display: 'inline-block', width: 'fit-content' }}>
                                OVERDUE
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Not specified</span>
                        )}
                      </td>
                      {/* 1. Rent Fee */}
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: 'var(--color-primary)' }}>
                        ৳{rentFee.toFixed(2)}
                      </td>
                      {/* 2. Discount */}
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: discount > 0 ? '#d97706' : 'var(--text-muted)' }}>
                        {discount > 0 ? `৳${discount.toFixed(2)}` : '৳0.00'}
                      </td>
                      {/* 3. Paid */}
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: paid > 0 ? 'var(--color-success)' : 'var(--text-secondary)' }}>
                        ৳{paid.toFixed(2)}
                      </td>
                      {/* 4. Due (No inline pay button) */}
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '12.5px' }}>
                        {due > 0 ? (
                          <span style={{ color: 'var(--color-danger)' }}>৳{due.toFixed(2)}</span>
                        ) : (
                          <span style={{ color: 'var(--color-success)', fontSize: '11.5px' }}>৳0.00</span>
                        )}
                      </td>
                      {/* Status */}
                      <td style={{ textAlign: 'center' }}>
                        {isReturned ? (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: 'rgba(5, 150, 105, 0.1)',
                            color: 'var(--color-success)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <Check size={11} /> Returned
                          </span>
                        ) : overdue ? (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: '#fee2e2',
                            color: 'var(--color-danger)'
                          }}>
                            Overdue
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: 'rgba(2, 132, 199, 0.1)',
                            color: 'var(--color-info)'
                          }}>
                            On Rent
                          </span>
                        )}
                      </td>
                      {/* Actions: Pay and Return */}
                      <td style={{ textAlign: 'center' }}>
                        {!isReturned ? (
                          <button
                            className="btn btn-sm"
                            disabled={actionLoading}
                            onClick={() => handleOpenReturnModal(r)}
                            style={{
                              padding: '3px 10px',
                              fontSize: '11.5px',
                              height: '26px',
                              background: '#ecfdf5',
                              border: '1px solid #a7f3d0',
                              color: '#047857',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title={due > 0 ? "Collect payment and return item" : "Mark as returned and restock item"}
                          >
                            <CheckCircle2 size={12} />
                            {due > 0 ? 'Pay & Return' : 'Return'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, padding: '2px 4px' }}>
                            Restocked
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <Pagination
            currentPage={currentPage}
            totalItems={filteredRentals.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {/* Return & Payment Modal */}
      {returnModalItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '16px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '20px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Process Rental Return & Payment</h3>
              </div>
              <button 
                className="btn-icon" 
                onClick={() => setReturnModalItem(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Product Info Card */}
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                  {returnModalItem.variant?.product?.name}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {returnModalItem.variant?.size} / {returnModalItem.variant?.color} · SKU: {returnModalItem.variant?.sku}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Invoice: #{returnModalItem.sale?.id?.substring(0, 8).toUpperCase()} {returnModalItem.sale?.customer_phone ? `· 📞 ${returnModalItem.sale.customer_phone}` : ''}
                </div>
              </div>

              {/* Outstanding Due Banner */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff1f2', border: '1px solid #fecdd3', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#9f1239' }}>Outstanding Invoice Due:</span>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#e11d48' }}>
                  ৳{Number(returnModalItem.sale?.due_amount || 0).toFixed(2)}
                </span>
              </div>

              {/* Payment Collection Inputs */}
              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '12px', marginBottom: '4px', display: 'block' }}>
                  Collect Payment Amount (৳)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={Number(returnModalItem.sale?.due_amount || 0)}
                  className="form-control"
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(Number(e.target.value))}
                  style={{ width: '100%', height: '36px', fontSize: '13.5px', fontWeight: 800, boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '12px', marginBottom: '4px', display: 'block' }}>
                  Payment Method
                </label>
                <select
                  className="form-control"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ width: '100%', height: '36px', fontSize: '12.5px', boxSizing: 'border-box' }}
                >
                  <option value="CASH">Cash</option>
                  <option value="BKASH">bKash</option>
                  <option value="CARD">Card</option>
                  <option value="NAGAD">Nagad</option>
                </select>
              </div>

              {/* Remaining Due Preview */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', padding: '2px 0' }}>
                <span>Remaining Due after this payment:</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  ৳{Math.max(0, Number(returnModalItem.sale?.due_amount || 0) - (collectAmount || 0)).toFixed(2)}
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                <button
                  className="btn btn-primary"
                  disabled={actionLoading}
                  onClick={() => handleProcessReturnWithPayment(true)}
                  style={{ width: '100%', height: '38px', fontWeight: 700, fontSize: '13px' }}
                >
                  {actionLoading ? 'Processing...' : `Collect ৳${collectAmount.toFixed(2)} & Mark Returned`}
                </button>

                <button
                  className="btn btn-secondary"
                  disabled={actionLoading}
                  onClick={() => handleProcessReturnWithPayment(false)}
                  style={{ width: '100%', height: '32px', fontSize: '12px', color: 'var(--text-secondary)' }}
                >
                  Mark Returned (Do Not Collect Due Now)
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
