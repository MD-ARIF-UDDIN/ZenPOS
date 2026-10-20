import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '../dbService';
import { useNotificationStore } from '../store';
import { Search, Clock, CheckCircle2, AlertCircle, RefreshCw, ShieldAlert, DollarSign, X, FileDown, CheckSquare, Square } from 'lucide-react';
import { Pagination } from './Pagination';
import { exportTableToPdf } from '../utils/pdfExport';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import { isAdminRole } from '../roleUtils';

type RentalFilter = 'all' | 'active' | 'overdue' | 'returned';

interface RentalsViewProps {
  onRefreshStats?: () => void;
  userRole?: string;
}

export interface RentalInvoiceGroup {
  saleId: string;
  invoiceCode: string;
  saleDate: string;
  customerName: string;
  customerPhone: string;
  guarantorName: string;
  guarantorPhone: string;
  totalAmount: number;
  discountAmount: number;
  payableAmount: number;
  receivedAmount: number;
  dueAmount: number;
  items: any[];
  activeItemsCount: number;
  returnedItemsCount: number;
  isFullyReturned: boolean;
  hasOverdue: boolean;
  earliestReturnDate: string | null;
}

export const RentalsView: React.FC<RentalsViewProps> = ({ onRefreshStats, userRole }) => {
  const { showToast } = useNotificationStore();
  const [rentals, setRentals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<RentalFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [actionLoading, setActionLoading] = useState(false);

  // Multi-Item Return Modal state
  const [returnModalGroup, setReturnModalGroup] = useState<RentalInvoiceGroup | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');

  const loadRentals = async () => {
    try {
      setLoading(true);
      const data = await dbService.getRentals();
      setRentals(data || []);
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

  // ── Group rental items by Invoice (sale_id) ──
  const invoiceGroups: RentalInvoiceGroup[] = useMemo(() => {
    const map = new Map<string, RentalInvoiceGroup>();

    rentals.forEach(item => {
      const saleId = item.sale_id || item.sale?.id || item.id;
      if (!map.has(saleId)) {
        const s = item.sale || {};
        map.set(saleId, {
          saleId,
          invoiceCode: s.invoice_code || (saleId.length > 8 ? saleId.substring(0, 8).toUpperCase() : saleId),
          saleDate: s.sale_date || item.created_at,
          customerName: s.customer_name || '',
          customerPhone: s.customer_phone || '',
          guarantorName: s.guarantor_name || '',
          guarantorPhone: s.guarantor_phone || '',
          totalAmount: Number(s.total_amount || 0),
          discountAmount: Number(s.discount_amount || 0),
          payableAmount: Number(s.payable_amount || 0),
          receivedAmount: Number(s.received_amount !== undefined && s.received_amount !== null ? s.received_amount : (s.payable_amount || 0)),
          dueAmount: Number(s.due_amount || 0),
          items: [],
          activeItemsCount: 0,
          returnedItemsCount: 0,
          isFullyReturned: true,
          hasOverdue: false,
          earliestReturnDate: null,
        });
      }

      const group = map.get(saleId)!;
      group.items.push(item);

      const overdue = isOverdue(item.return_date, item.is_returned);
      if (overdue) group.hasOverdue = true;

      if (item.is_returned) {
        group.returnedItemsCount++;
      } else {
        group.activeItemsCount++;
        group.isFullyReturned = false;
        if (!group.earliestReturnDate || (item.return_date && item.return_date < group.earliestReturnDate)) {
          group.earliestReturnDate = item.return_date;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()
    );
  }, [rentals]);

  // ── Filter and Search ──
  const filteredInvoices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return invoiceGroups.filter(inv => {
      // Filter tab
      if (filter === 'active' && inv.isFullyReturned) return false;
      if (filter === 'overdue' && !inv.hasOverdue) return false;
      if (filter === 'returned' && !inv.isFullyReturned) return false;

      // Search
      if (!q) return true;
      const matchesCustomer =
        inv.customerName.toLowerCase().includes(q) ||
        inv.customerPhone.includes(q) ||
        inv.guarantorName.toLowerCase().includes(q) ||
        inv.guarantorPhone.includes(q) ||
        inv.invoiceCode.toLowerCase().includes(q);

      if (matchesCustomer) return true;

      const matchesItems = inv.items.some(it =>
        it.variant?.product?.name?.toLowerCase().includes(q) ||
        it.variant?.sku?.toLowerCase().includes(q) ||
        it.variant?.barcode?.toLowerCase().includes(q)
      );

      return matchesItems;
    });
  }, [invoiceGroups, filter, searchQuery]);

  // KPI Calculations
  const totalInvoicesCount = invoiceGroups.length;
  const activeInvoicesCount = invoiceGroups.filter(inv => !inv.isFullyReturned).length;
  const overdueInvoicesCount = invoiceGroups.filter(inv => inv.hasOverdue).length;
  const totalPendingDue = invoiceGroups.reduce((acc, inv) => acc + inv.dueAmount, 0);
  const totalRentalRevenue = invoiceGroups.reduce((acc, inv) => acc + (inv.payableAmount || inv.totalAmount), 0);

  // Open multi-item return modal
  const handleOpenReturnModal = (group: RentalInvoiceGroup) => {
    setReturnModalGroup(group);
    // Select all currently unreturned items by default
    const activeIds = group.items.filter(it => !it.is_returned).map(it => it.id);
    setSelectedItemIds(activeIds);
    setCollectAmount(group.dueAmount);
    setPaymentMethod('CASH');
  };

  // Toggle item selection in return modal
  const handleToggleItemSelection = (id: string) => {
    setSelectedItemIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Toggle select all active items
  const handleToggleSelectAll = () => {
    if (!returnModalGroup) return;
    const activeItems = returnModalGroup.items.filter(it => !it.is_returned);
    if (selectedItemIds.length === activeItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(activeItems.map(it => it.id));
    }
  };

  // Process return with/without payment
  const handleProcessReturn = async (collectDue: boolean) => {
    if (!returnModalGroup || selectedItemIds.length === 0) {
      showToast('Please select at least 1 item to return', 'error');
      return;
    }
    const group = returnModalGroup;
    const itemsToReturn = group.items
      .filter(it => selectedItemIds.includes(it.id))
      .map(it => ({
        saleItemId: it.id,
        variantId: it.variant_id,
        currentStock: it.variant?.stock_quantity ?? 0
      }));

    const amountToCollect = collectDue ? Math.min(Number(collectAmount || 0), group.dueAmount) : 0;

    try {
      setActionLoading(true);
      await dbService.markMultipleRentalsReturned(
        itemsToReturn,
        amountToCollect > 0 ? {
          saleId: group.saleId,
          collectAmount: amountToCollect,
          paymentMethod
        } : undefined
      );

      const msg = `Returned ${itemsToReturn.length} item(s) successfully!${amountToCollect > 0 ? ` Collected ৳${amountToCollect.toFixed(2)}` : ''}`;
      showToast(msg, 'success');
      setReturnModalGroup(null);
      await loadRentals();
      onRefreshStats?.();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to process return', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPdf = () => {
    exportTableToPdf({
      moduleName: 'Rentals',
      title: 'Rentals & Bookings Ledger Report',
      subtitle: `Status Filter: ${filter.toUpperCase()}`,
      summaryCards: [
        { label: 'Total Invoices', value: String(totalInvoicesCount) },
        { label: 'Active Invoices', value: String(activeInvoicesCount) },
        { label: 'Overdue Invoices', value: String(overdueInvoicesCount) },
        { label: 'Total Pending Due', value: `৳${totalPendingDue.toFixed(2)}` },
        { label: 'Total Rental Revenue', value: `৳${totalRentalRevenue.toFixed(2)}` }
      ],
      columns: [
        { header: 'Invoice', key: 'invoiceCode' },
        { header: 'Customer', key: 'customerName', format: (_, row) => [row.customerName, row.customerPhone].filter(Boolean).join(' - ') || 'Walk-in' },
        { header: 'Guarantor', key: 'guarantorName', format: (_, row) => [row.guarantorName, row.guarantorPhone].filter(Boolean).join(' - ') || '-' },
        { header: 'Items', key: 'items', format: (items) => items.map((it: any) => `${it.variant?.product?.name || 'Item'} (${it.is_returned ? 'Returned' : 'On Rent'})`).join(', ') },
        { header: 'Rent Date', key: 'saleDate', format: (v) => formatDateDDMMYYYY(v) },
        { header: 'Total Payable', key: 'payableAmount', align: 'right', format: (v) => `৳${Number(v || 0).toFixed(2)}` },
        { header: 'Paid', key: 'receivedAmount', align: 'right', format: (v) => `৳${Number(v || 0).toFixed(2)}` },
        { header: 'Due', key: 'dueAmount', align: 'right', format: (v) => `৳${Number(v || 0).toFixed(2)}` },
        { header: 'Status', key: 'isFullyReturned', align: 'center', format: (v, row) => (v ? 'Returned' : row.hasOverdue ? 'OVERDUE' : 'Active On Rent') }
      ],
      data: filteredInvoices
    });
  };

  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title">Total Rental Orders</div>
              <div className="card-value">{totalInvoicesCount}</div>
            </div>
            <span style={{ background: 'rgba(11, 37, 69, 0.08)', color: 'var(--color-primary)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
              <Clock size={18} />
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title">Active Orders</div>
              <div className="card-value" style={{ color: 'var(--color-info)' }}>{activeInvoicesCount}</div>
            </div>
            <span style={{ background: 'rgba(2, 132, 199, 0.08)', color: 'var(--color-info)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
              <AlertCircle size={18} />
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title">Overdue Orders</div>
              <div className="card-value" style={{ color: overdueInvoicesCount > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                {overdueInvoicesCount}
              </div>
            </div>
            <span style={{ background: overdueInvoicesCount > 0 ? 'rgba(225, 29, 72, 0.08)' : 'rgba(148, 163, 184, 0.08)', color: overdueInvoicesCount > 0 ? 'var(--color-danger)' : 'var(--text-muted)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
              <ShieldAlert size={18} />
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title">Total Pending Due</div>
              <div className="card-value" style={{ color: totalPendingDue > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                ৳{totalPendingDue.toFixed(2)}
              </div>
            </div>
            <span style={{ background: totalPendingDue > 0 ? 'rgba(225, 29, 72, 0.08)' : 'rgba(5, 150, 105, 0.08)', color: totalPendingDue > 0 ? 'var(--color-danger)' : 'var(--color-success)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
              <DollarSign size={18} />
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        
        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
          {(['all', 'active', 'overdue', 'returned'] as RentalFilter[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className="btn btn-sm"
              onClick={() => { setFilter(tab); setCurrentPage(1); }}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '4px',
                border: 'none',
                background: filter === tab ? 'var(--color-primary)' : 'transparent',
                color: filter === tab ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {tab === 'all' ? 'All Orders' : tab === 'active' ? `Active (${activeInvoicesCount})` : tab === 'overdue' ? `Overdue (${overdueInvoicesCount})` : 'Returned'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 240px', maxWidth: '400px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search invoice, customer, product, barcode..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            style={{ paddingLeft: '32px', height: '36px', fontSize: '12px', width: '100%' }}
          />
        </div>

        {/* Action Buttons */}
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

      {/* Grouped Invoices Table */}
      {loading ? (
        <div style={{ padding: '24px', fontSize: '13px' }}>Loading rentals ledger...</div>
      ) : (
        <div className="table-container">
          <table className="table" style={{ minWidth: '950px' }}>
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>Sl.</th>
                <th>Invoice</th>
                <th>Customer & Guarantor</th>
                <th>Rented Product(s)</th>
                <th>Rent Date</th>
                <th>Return Deadline</th>
                <th style={{ textAlign: 'right' }}>Total Fee</th>
                <th style={{ textAlign: 'right' }}>Paid</th>
                <th style={{ textAlign: 'right' }}>Due</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ width: '130px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
                    No rental orders found for the selected filter.
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((inv, idx) => {
                  const statusColor = inv.isFullyReturned ? 'var(--color-success)' : inv.hasOverdue ? 'var(--color-danger)' : 'var(--color-info)';

                  return (
                    <tr key={inv.saleId}>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>

                      {/* Invoice Code */}
                      <td>
                        <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--color-primary)' }}>
                          #{inv.invoiceCode}
                        </span>
                      </td>

                      {/* Customer & Guarantor */}
                      <td>
                        <div style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--text-primary)' }}>
                          {inv.customerName || 'Walk-in Customer'}
                        </div>
                        {inv.customerPhone && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            📞 {inv.customerPhone}
                          </div>
                        )}
                        {(inv.guarantorName || inv.guarantorPhone) && (
                          <div style={{ fontSize: '10.5px', color: '#6d28d9', marginTop: '2px', fontWeight: 600 }}>
                            🛡️ {[inv.guarantorName, inv.guarantorPhone].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </td>

                      {/* Rented Products List with individual badges */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {inv.items.map((it: any) => {
                            const pName = it.variant?.product?.name || 'Item';
                            const sizeColor = [it.variant?.size, it.variant?.color].filter(Boolean).join(' / ');
                            const overdue = isOverdue(it.return_date, it.is_returned);

                            return (
                              <div
                                key={it.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '8px',
                                  background: it.is_returned ? '#f8fafc' : '#ffffff',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '4px',
                                  padding: '3px 6px',
                                  fontSize: '11.5px',
                                  opacity: it.is_returned ? 0.75 : 1
                                }}
                              >
                                <div>
                                  <span style={{ fontWeight: 700, color: it.is_returned ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                                    {pName}
                                  </span>
                                  {sizeColor && (
                                    <span style={{ color: 'var(--text-secondary)', marginLeft: '4px', fontSize: '10.5px' }}>
                                      ({sizeColor})
                                    </span>
                                  )}
                                  {it.variant?.sku && (
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '4px' }}>
                                      · {it.variant.sku}
                                    </span>
                                  )}
                                </div>

                                <span style={{
                                  fontSize: '10px',
                                  fontWeight: 800,
                                  padding: '1px 6px',
                                  borderRadius: '3px',
                                  whiteSpace: 'nowrap',
                                  background: it.is_returned ? '#e2e8f0' : overdue ? '#ffe4e6' : '#e0f2fe',
                                  color: it.is_returned ? '#475569' : overdue ? '#e11d48' : '#0284c7'
                                }}>
                                  {it.is_returned ? '✓ Returned' : overdue ? '⚠️ Overdue' : '⏱ On Rent'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* Rent Date */}
                      <td style={{ fontSize: '11.5px', fontWeight: 600 }}>
                        {formatDateDDMMYYYY(inv.saleDate)}
                      </td>

                      {/* Expected Return Deadline */}
                      <td>
                        {inv.isFullyReturned ? (
                          <span style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 600 }}>All Returned</span>
                        ) : (
                          <span style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            color: inv.hasOverdue ? 'var(--color-danger)' : 'inherit'
                          }}>
                            {inv.earliestReturnDate ? formatDateDDMMYYYY(inv.earliestReturnDate) : '-'}
                          </span>
                        )}
                      </td>

                      {/* Financials */}
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        ৳{(inv.payableAmount || inv.totalAmount).toFixed(2)}
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-success)' }}>
                        ৳{inv.receivedAmount.toFixed(2)}
                      </td>

                      <td style={{
                        textAlign: 'right',
                        fontWeight: 800,
                        color: inv.dueAmount > 0 ? 'var(--color-danger)' : 'inherit'
                      }}>
                        {inv.dueAmount > 0 ? `৳${inv.dueAmount.toFixed(2)}` : '৳0.00'}
                      </td>

                      {/* Status */}
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 800,
                          background: inv.isFullyReturned ? 'rgba(16, 185, 129, 0.1)' : inv.hasOverdue ? 'rgba(239, 68, 68, 0.1)' : 'rgba(2, 132, 199, 0.1)',
                          color: statusColor,
                          whiteSpace: 'nowrap'
                        }}>
                          {inv.isFullyReturned ? '✓ Fully Returned' : inv.hasOverdue ? '⚠️ Overdue' : `On Rent (${inv.returnedItemsCount}/${inv.items.length})`}
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ textAlign: 'center' }}>
                        {!inv.isFullyReturned ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleOpenReturnModal(inv)}
                            style={{ height: '30px', padding: '0 10px', fontSize: '11.5px', fontWeight: 700, width: '100%' }}
                          >
                            Return Items
                          </button>
                        ) : inv.dueAmount > 0 ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenReturnModal(inv)}
                            style={{ height: '30px', padding: '0 10px', fontSize: '11.5px', fontWeight: 700, width: '100%', color: 'var(--color-danger)' }}
                          >
                            Collect Due
                          </button>
                        ) : (
                          <span style={{ fontSize: '11.5px', color: 'var(--color-success)', fontWeight: 700 }}>
                            ✓ Settled
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalItems={filteredInvoices.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(newSize) => { setPageSize(newSize); setCurrentPage(1); }}
      />

      {/* ── Multi-Item Return & Payment Collection Modal ── */}
      {returnModalGroup && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '16px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '20px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>
                  Rental Return — Invoice #{returnModalGroup.invoiceCode}
                </h3>
              </div>
              <button 
                className="btn-icon" 
                onClick={() => setReturnModalGroup(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Customer Info Card */}
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  👤 Customer: {[returnModalGroup.customerName, returnModalGroup.customerPhone].filter(Boolean).join(' · 📞 ') || 'Walk-in'}
                </div>
                {(returnModalGroup.guarantorName || returnModalGroup.guarantorPhone) && (
                  <div style={{ color: '#6d28d9', marginTop: '2px', fontWeight: 600, fontSize: '11px' }}>
                    🛡️ Guarantor: {[returnModalGroup.guarantorName, returnModalGroup.guarantorPhone].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>

              {/* Item Selection List */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '12px', margin: 0 }}>
                    Select Items to Return:
                  </label>

                  {/* Toggle All Active */}
                  {returnModalGroup.items.filter(it => !it.is_returned).length > 1 && (
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-primary)',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {selectedItemIds.length === returnModalGroup.items.filter(it => !it.is_returned).length
                        ? <CheckSquare size={13} />
                        : <Square size={13} />
                      }
                      Select All
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                  {returnModalGroup.items.map((it: any) => {
                    const isAlreadyReturned = !!it.is_returned;
                    const isSelected = selectedItemIds.includes(it.id);

                    return (
                      <div
                        key={it.id}
                        onClick={() => {
                          if (!isAlreadyReturned) handleToggleItemSelection(it.id);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 10px',
                          borderRadius: '4px',
                          border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-color)'}`,
                          background: isAlreadyReturned ? '#f1f5f9' : isSelected ? 'var(--color-primary-light)' : '#ffffff',
                          cursor: isAlreadyReturned ? 'not-allowed' : 'pointer',
                          opacity: isAlreadyReturned ? 0.6 : 1
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected || isAlreadyReturned}
                          disabled={isAlreadyReturned}
                          onChange={() => {}}
                          style={{ cursor: isAlreadyReturned ? 'not-allowed' : 'pointer' }}
                        />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--text-primary)' }}>
                            {it.variant?.product?.name || 'Rented Item'}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            Size: {it.variant?.size || 'N/A'} · Color: {it.variant?.color || 'N/A'} {it.variant?.sku ? `· SKU: ${it.variant.sku}` : ''}
                          </div>
                        </div>

                        {isAlreadyReturned ? (
                          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--color-success)', whiteSpace: 'nowrap' }}>
                            ✓ Already Returned
                          </span>
                        ) : (
                          <span style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>
                            ৳{Number(it.total_price || 0).toFixed(2)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Outstanding Due Banner */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff1f2', border: '1px solid #fecdd3', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#9f1239' }}>Outstanding Due:</span>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#e11d48' }}>
                  ৳{returnModalGroup.dueAmount.toFixed(2)}
                </span>
              </div>

              {/* Payment Collection Inputs */}
              {returnModalGroup.dueAmount > 0 && (
                <>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '12px', marginBottom: '4px', display: 'block' }}>
                      Collect Payment Amount (৳)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={returnModalGroup.dueAmount}
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

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    <span>Remaining Due after payment:</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      ৳{Math.max(0, returnModalGroup.dueAmount - (collectAmount || 0)).toFixed(2)}
                    </span>
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={actionLoading || selectedItemIds.length === 0}
                  onClick={() => handleProcessReturn(true)}
                  style={{ width: '100%', height: '38px', fontWeight: 700, fontSize: '13px' }}
                >
                  {actionLoading
                    ? 'Processing...'
                    : collectAmount > 0
                    ? `Return ${selectedItemIds.length} Item(s) & Collect ৳${collectAmount.toFixed(2)}`
                    : `Return ${selectedItemIds.length} Item(s)`
                  }
                </button>

                {returnModalGroup.dueAmount > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={actionLoading || selectedItemIds.length === 0}
                    onClick={() => handleProcessReturn(false)}
                    style={{ width: '100%', height: '32px', fontSize: '11.5px', color: 'var(--text-secondary)' }}
                  >
                    Return Items (Do Not Collect Due Now)
                  </button>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
