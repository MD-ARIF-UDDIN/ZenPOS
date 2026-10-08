import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import type { ProductVariant } from '../store';
import { DollarSign, ShoppingBag, Calendar, Package, Receipt, Boxes, RotateCcw, FileDown } from 'lucide-react';
import { Pagination } from './Pagination';
import { exportTableToPdf } from '../utils/pdfExport';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import { isAdminRole } from '../roleUtils';

type DateFilter = 'today' | 'week' | 'month' | 'month_select' | 'custom' | 'all';

interface ReportsViewProps {
  userRole?: string;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ userRole }) => {
  const [sales, setSales] = useState<any[]>([]);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Date filter & pagination state
  const [filter, setFilter] = useState<DateFilter>('today');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadData = async () => {
    try {
      setLoading(true);
      const [salesList, itemsList, variantList, expenseList] = await Promise.all([
        dbService.getSales(),
        dbService.getSaleItemsDetailed(),
        dbService.getVariants(),
        dbService.getExpenses()
      ]);
      
      setSales(salesList);
      setSaleItems(itemsList);
      setVariants(variantList);
      setExpenses(expenseList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter helper
  const filterByDate = (dateStr: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filter) {
      case 'today':
        return date >= startOfToday;
      case 'week':
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return date >= sevenDaysAgo;
      case 'month':
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return date >= thirtyDaysAgo;
      case 'month_select':
        if (selectedMonth) {
          const [yStr, mStr] = selectedMonth.split('-');
          const year = Number(yStr);
          const month = Number(mStr) - 1;
          return date.getFullYear() === year && date.getMonth() === month;
        }
        return true;
      case 'custom':
        if (startDate && endDate) {
          const start = new Date(startDate + 'T00:00:00');
          const end = new Date(endDate + 'T23:59:59.999');
          return date >= start && date <= end;
        } else if (startDate) {
          const start = new Date(startDate + 'T00:00:00');
          return date >= start;
        } else if (endDate) {
          const end = new Date(endDate + 'T23:59:59.999');
          return date <= end;
        }
        return true;
      case 'all':
      default:
        return true;
    }
  };

  // Filtered datasets
  const filteredSales = sales.filter(s => filterByDate(s.sale_date));
  const filteredItems = saleItems.filter(si => si.sale && filterByDate(si.sale.sale_date));

  // Filtered expenses
  const filteredExpenses = expenses.filter(exp => filterByDate(exp.expense_date));

  // Compute stats
  const totalRevenue = filteredSales.reduce((acc, s) => acc + Number(s.payable_amount), 0);
  
  let totalProfit = 0; // Gross profit (Revenue - COGS)
  let totalRefunds = 0;
  let totalReturnedUnits = 0;

  filteredItems.forEach(si => {
    const isReturn = si.sale_type === 'RETURN' || si.is_returned;
    const v = variants.find(x => x.id === si.variant_id);
    if (isReturn) {
      totalRefunds += Math.abs(Number(si.total_price || (si.quantity * si.unit_price) || 0));
      totalReturnedUnits += Number(si.quantity || 0);
      if (v) {
        const profitLoss = Number(si.quantity || 0) * (Number(si.unit_price || 0) - Number(v.purchase_price || 0));
        totalProfit -= profitLoss;
      }
    } else {
      if (v) {
        const profitGain = Number(si.quantity || 0) * (Number(si.unit_price || 0) - Number(v.purchase_price || 0));
        totalProfit += profitGain;
      }
    }
  });

  const totalExpenses = filteredExpenses.reduce((acc, exp) => acc + Number(exp.amount), 0);
  const totalStockUnits = variants.reduce((acc, v) => acc + (v.stock_quantity || 0), 0);
  const totalStockValuation = variants.reduce((acc, v) => acc + ((v.stock_quantity || 0) * (v.purchase_price || 0)), 0);
  const overallNetProfit = totalProfit - totalExpenses;

  const getDateKey = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const formatDateDisplay = (dateKey: string) => {
    try {
      const parts = dateKey.split('-');
      if (parts.length === 3) {
        const day = parts[2].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[0];
        return `${day}/${month}/${year}`;
      }
      return formatDateDDMMYYYY(dateKey);
    } catch {
      return formatDateDDMMYYYY(dateKey);
    }
  };

  // Date-wise Breakdown
  const dateStatsMap: {
    [key: string]: {
      dateKey: string;
      orderCount: number;
      unitsSold: number;
      revenue: number;
      productProfit: number;
      expenses: number;
      netProfit: number;
    }
  } = {};

  const getOrCreateDateStat = (dateKey: string) => {
    if (!dateStatsMap[dateKey]) {
      dateStatsMap[dateKey] = {
        dateKey,
        orderCount: 0,
        unitsSold: 0,
        revenue: 0,
        productProfit: 0,
        expenses: 0,
        netProfit: 0
      };
    }
    return dateStatsMap[dateKey];
  };

  filteredSales.forEach(s => {
    const key = getDateKey(s.sale_date);
    if (!key) return;
    const stat = getOrCreateDateStat(key);
    stat.orderCount += 1;
    stat.revenue += Number(s.payable_amount || 0);
  });

  filteredItems.forEach(si => {
    if (!si.sale?.sale_date) return;
    const key = getDateKey(si.sale.sale_date);
    if (!key) return;
    const stat = getOrCreateDateStat(key);
    const isReturn = si.sale_type === 'RETURN' || si.is_returned;

    if (isReturn) {
      stat.unitsSold -= Number(si.quantity || 0);
    } else {
      stat.unitsSold += Number(si.quantity || 0);
    }

    const v = variants.find(x => x.id === si.variant_id);
    if (v) {
      const profitVal = Number(si.quantity || 0) * (Number(si.unit_price || 0) - Number(v.purchase_price || 0));
      if (isReturn) {
        stat.productProfit -= profitVal;
      } else {
        stat.productProfit += profitVal;
      }
    }
  });

  filteredExpenses.forEach(exp => {
    const key = getDateKey(exp.expense_date);
    if (!key) return;
    const stat = getOrCreateDateStat(key);
    stat.expenses += Number(exp.amount || 0);
  });

  Object.values(dateStatsMap).forEach(stat => {
    stat.netProfit = stat.productProfit - stat.expenses;
  });

  const dateStatsList = Object.values(dateStatsMap).sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  const handleDownloadPdf = () => {
    exportTableToPdf({
      moduleName: 'Reports',
      title: 'Business Performance Report',
      dateRange: filter === 'all' 
        ? 'All Time' 
        : filter === 'week' 
        ? 'This Week' 
        : filter === 'month' 
        ? 'This Month' 
        : filter === 'month_select' 
        ? `Month: ${selectedMonth}` 
        : filter === 'custom' 
        ? `${startDate || 'Start'} to ${endDate || 'End'}` 
        : 'Today',
      summaryCards: [
        { label: 'Total Sales', value: `৳${totalRevenue.toFixed(2)}` },
        { label: 'Returns / Refunds', value: `-৳${totalRefunds.toFixed(2)}` },
        { label: 'Product Profit', value: `৳${totalProfit.toFixed(2)}` },
        { label: 'Shop Expenses', value: `৳${totalExpenses.toFixed(2)}` },
        { label: 'Net Profit', value: `৳${overallNetProfit.toFixed(2)}` },
        { label: 'Total Orders', value: String(filteredSales.length) }
      ],
      columns: [
        { header: 'Date', key: 'dateKey', format: (v) => formatDateDisplay(v) },
        { header: 'Orders', key: 'orderCount', align: 'center' },
        { header: 'Units Sold', key: 'unitsSold', align: 'center' },
        { header: 'Total Sales', key: 'revenue', align: 'right', format: (v) => `৳${Number(v || 0).toFixed(2)}` },
        { header: 'Product Profit', key: 'productProfit', align: 'right', format: (v) => `৳${Number(v || 0).toFixed(2)}` },
        { header: 'Expenses', key: 'expenses', align: 'right', format: (v) => `৳${Number(v || 0).toFixed(2)}` },
        { header: 'Net Profit', key: 'netProfit', align: 'right', format: (v) => `৳${Number(v || 0).toFixed(2)}` }
      ],
      data: dateStatsList
    });
  };

  if (loading) return <div style={{ padding: '24px' }}>Loading business analytics...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      
      {/* Date Range Selector */}
      <div className="reports-filter-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Business Performance Reports</h3>
          {isAdminRole(userRole) && (
            <button
              onClick={handleDownloadPdf}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0 10px', height: '28px', fontSize: '11.5px', gap: '5px', fontWeight: 700 }}
              title="Download PDF Report"
            >
              <FileDown size={13} />
              <span>Download PDF</span>
            </button>
          )}
        </div>
        
        <div className="reports-tabs-wrapper">
          <div className="reports-tabs-scroll">
            {(['today', 'week', 'month', 'month_select', 'custom', 'all'] as const).map(option => (
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
                <Calendar size={11} style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline' }} />
                <span>
                  {option === 'all' 
                    ? 'All Time' 
                    : option === 'week' 
                    ? 'This Week' 
                    : option === 'month' 
                    ? 'This Month' 
                    : option === 'month_select'
                    ? 'Select Month'
                    : option === 'custom'
                    ? 'Custom Range'
                    : 'Today'}
                </span>
              </button>
            ))}
          </div>

          {filter === 'month_select' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 8px',
              height: '34px',
              boxShadow: 'var(--shadow-xs)',
              width: '100%',
              maxWidth: '100%'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>Month:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '11.5px',
                    outline: 'none',
                    fontWeight: 600,
                    color: '#1e293b',
                    height: '26px',
                    cursor: 'pointer',
                    flex: 1,
                    minWidth: 0
                  }}
                />
              </div>
            </div>
          )}

          {filter === 'custom' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '6px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 8px',
              boxShadow: 'var(--shadow-xs)',
              width: '100%',
              maxWidth: '100%'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: '1 1 120px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '11.5px',
                    outline: 'none',
                    fontWeight: 600,
                    color: '#1e293b',
                    height: '26px',
                    flex: 1,
                    minWidth: 0
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: '1 1 120px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '11.5px',
                    outline: 'none',
                    fontWeight: 600,
                    color: '#1e293b',
                    height: '26px',
                    flex: 1,
                    minWidth: 0
                  }}
                />
              </div>

              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setCurrentPage(1);
                  }}
                  style={{
                    fontSize: '10.5px',
                    padding: '0 8px',
                    height: '26px',
                    background: '#f1f5f9',
                    color: '#64748b',
                    border: '1px solid #cbd5e1',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                  title="Reset date inputs"
                >
                  Reset
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* KPI Stats Cards - 2 per row on mobile */}
      <div className="reports-kpi-grid">
        
        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="card-title">Total Sales</div>
              <div className="card-value">৳{totalRevenue.toFixed(2)}</div>
            </div>
            <span style={{ flexShrink: 0, background: 'rgba(11, 37, 69, 0.08)', color: 'var(--color-primary)', padding: '7px', borderRadius: 'var(--radius-sm)' }}>
              <DollarSign size={16} />
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="card-title">Returns/Refunds</div>
              <div className="card-value" style={{ color: totalRefunds > 0 ? '#dc2626' : 'var(--text-muted)' }}>
                {totalRefunds > 0 ? `-৳${totalRefunds.toFixed(2)}` : '৳0.00'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {totalReturnedUnits} pcs
              </div>
            </div>
            <span style={{ flexShrink: 0, background: '#fee2e2', color: '#dc2626', padding: '7px', borderRadius: 'var(--radius-sm)' }}>
              <RotateCcw size={16} />
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="card-title">Product Profit</div>
              <div className="card-value" style={{ color: 'var(--color-info)' }}>
                ৳{totalProfit.toFixed(2)}
              </div>
            </div>
            <span style={{ flexShrink: 0, background: 'rgba(2, 132, 199, 0.08)', color: 'var(--color-info)', padding: '7px', borderRadius: 'var(--radius-sm)' }}>
              <Package size={16} />
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="card-title">Shop Expenses</div>
              <div className="card-value" style={{ color: 'var(--color-danger)' }}>
                ৳{totalExpenses.toFixed(2)}
              </div>
            </div>
            <span style={{ flexShrink: 0, background: 'rgba(225, 29, 72, 0.08)', color: 'var(--color-danger)', padding: '7px', borderRadius: 'var(--radius-sm)' }}>
              <Receipt size={16} />
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="card-title">Stock Valuation</div>
              <div className="card-value" style={{ color: 'var(--text-primary)' }}>
                ৳{totalStockValuation.toFixed(2)}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {totalStockUnits} units in stock
              </div>
            </div>
            <span style={{ flexShrink: 0, background: 'rgba(11, 37, 69, 0.08)', color: 'var(--color-primary)', padding: '7px', borderRadius: 'var(--radius-sm)' }}>
              <Boxes size={16} />
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="card-title">Net Profit</div>
              <div className="card-value" style={{ color: overallNetProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                ৳{overallNetProfit.toFixed(2)}
              </div>
            </div>
            <span style={{ 
              flexShrink: 0,
              background: overallNetProfit >= 0 ? 'rgba(5, 150, 105, 0.08)' : 'rgba(225, 29, 72, 0.08)', 
              color: overallNetProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)', 
              padding: '7px', 
              borderRadius: 'var(--radius-sm)' 
            }}>
              <DollarSign size={16} />
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="card-title">Total Orders</div>
              <div className="card-value">{filteredSales.length}</div>
            </div>
            <span style={{ flexShrink: 0, background: 'rgba(148, 163, 184, 0.08)', color: 'var(--text-secondary)', padding: '7px', borderRadius: 'var(--radius-sm)' }}>
              <ShoppingBag size={16} />
            </span>
          </div>
        </div>

      </div>

      {/* Date-wise Performance Breakdown */}
      <div>
        <h3 style={{ marginBottom: '10px', fontSize: '14px', fontWeight: 800 }}>Date-wise Performance Breakdown</h3>
        
        {dateStatsList.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '28px', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
            No sales or expense activity recorded for this time range.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="table-container reports-desktop-table">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>Sl.</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'center' }}>Orders</th>
                    <th style={{ textAlign: 'center' }}>Units Sold</th>
                    <th style={{ textAlign: 'right' }}>Total Sales</th>
                    <th style={{ textAlign: 'right' }}>Product Profit</th>
                    <th style={{ textAlign: 'right' }}>Expenses</th>
                    <th style={{ textAlign: 'right' }}>Net Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {dateStatsList
                    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                    .map((item, idx) => (
                    <tr key={item.dateKey}>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--text-primary)' }}>
                        {formatDateDisplay(item.dateKey)}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.orderCount}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.unitsSold}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>৳{item.revenue.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-info)' }}>৳{item.productProfit.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: item.expenses > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                        ৳{item.expenses.toFixed(2)}
                      </td>
                      <td style={{ 
                        textAlign: 'right', 
                        fontWeight: 800, 
                        color: item.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' 
                      }}>
                        ৳{item.netProfit.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="reports-mobile-cards">
              {dateStatsList
                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                .map((item, idx) => (
                <div 
                  key={item.dateKey}
                  className="card"
                  style={{
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>#{(currentPage - 1) * pageSize + idx + 1}</span>
                      <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>
                        {formatDateDisplay(item.dateKey)}
                      </span>
                    </div>
                    <span style={{ 
                      fontSize: '10.5px', 
                      fontWeight: 700, 
                      background: 'var(--color-primary-light)', 
                      color: 'var(--color-primary)', 
                      padding: '2px 7px', 
                      borderRadius: '4px' 
                    }}>
                      {item.orderCount} orders · {item.unitsSold} pcs
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11.5px' }}>
                    <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '4px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Total Sales</div>
                      <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>৳{item.revenue.toFixed(2)}</div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '4px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Product Profit</div>
                      <div style={{ fontWeight: 800, color: 'var(--color-info)' }}>৳{item.productProfit.toFixed(2)}</div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '4px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Shop Expenses</div>
                      <div style={{ fontWeight: 800, color: item.expenses > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                        ৳{item.expenses.toFixed(2)}
                      </div>
                    </div>

                    <div style={{ 
                      background: item.netProfit >= 0 ? '#ecfdf5' : '#fef2f2', 
                      padding: '6px 8px', 
                      borderRadius: '4px',
                      border: item.netProfit >= 0 ? '1px solid #d1fae5' : '1px solid #fee2e2'
                    }}>
                      <div style={{ fontSize: '10px', color: item.netProfit >= 0 ? '#065f46' : '#991b1b', fontWeight: 600 }}>Net Profit</div>
                      <div style={{ fontWeight: 800, color: item.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        ৳{item.netProfit.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Pagination 
              currentPage={currentPage}
              totalItems={dateStatsList.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>

    </div>
  );
};
