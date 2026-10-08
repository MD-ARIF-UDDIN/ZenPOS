import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '../dbService';
import type { ProductVariant } from '../store';
import { Calendar, FileDown, Search } from 'lucide-react';
import { Pagination } from './Pagination';
import { exportTableToPdf } from '../utils/pdfExport';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import { isAdminRole } from '../roleUtils';

type DateFilter = 'today' | 'week' | 'month' | 'month_select' | 'custom' | 'all';
type ReportType = 'BY_DATE' | 'BY_PRODUCT';
type ProductSortKey = 'sales' | 'profit' | 'units' | 'stock' | 'name';

interface ReportsViewProps {
  userRole?: string;
}

interface MotherProductStat {
  productId: string;
  productName: string;
  category: string;
  brand: string;
  variantsCount: number;
  currentStock: number;
  unitsSold: number;
  unitsReturned: number;
  netUnitsSold: number;
  grossSales: number;
  discount: number;
  refundAmount: number;
  netSales: number;
  totalCogs: number;
  productProfit: number;
  marginPct: number;
  orderCount: number;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ userRole }) => {
  const [sales, setSales] = useState<any[]>([]);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Report mode & Date filter state
  const [reportType, setReportType] = useState<ReportType>('BY_DATE');
  const [filter, setFilter] = useState<DateFilter>('today');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Product report search & sorting
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productSortBy, setProductSortBy] = useState<ProductSortKey>('sales');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadData = async (force = true) => {
    try {
      setLoading(true);
      const [salesList, itemsList, variantList, expenseList] = await Promise.all([
        dbService.getSales(force),
        dbService.getSaleItemsDetailed(force),
        dbService.getVariants(force),
        dbService.getExpenses(force)
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
    loadData(true);
  }, [reportType]);

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

  // Filtered datasets based on date filter
  const filteredSales = useMemo(() => sales.filter(s => filterByDate(s.sale_date)), [sales, filter, selectedMonth, startDate, endDate]);
  const filteredItems = useMemo(() => saleItems.filter(si => si.sale && filterByDate(si.sale.sale_date)), [saleItems, filter, selectedMonth, startDate, endDate]);
  const filteredExpenses = useMemo(() => expenses.filter(exp => filterByDate(exp.expense_date)), [expenses, filter, selectedMonth, startDate, endDate]);

  // Fast variant lookup map
  const variantsMap = useMemo(() => new Map(variants.map(v => [v.id, v])), [variants]);

  // Overall Business KPIs
  const totalRevenue = useMemo(() => filteredSales.reduce((acc, s) => acc + Number(s.payable_amount || 0), 0), [filteredSales]);
  const totalDiscount = useMemo(() => filteredSales.reduce((acc, s) => acc + Number(s.discount_amount || 0), 0), [filteredSales]);
  
  let totalProfit = 0; // Gross profit (Revenue - COGS)
  let totalRefunds = 0;
  let totalReturnedUnits = 0;

  filteredItems.forEach(si => {
    const isReturn = si.sale_type === 'RETURN' || si.is_returned;
    const v = variantsMap.get(si.variant_id);
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

  const totalExpenses = useMemo(() => filteredExpenses.reduce((acc, exp) => acc + Number(exp.amount || 0), 0), [filteredExpenses]);
  const totalStockUnits = useMemo(() => variants.reduce((acc, v) => acc + (v.stock_quantity || 0), 0), [variants]);
  const totalStockValuation = useMemo(() => variants.reduce((acc, v) => acc + ((v.stock_quantity || 0) * (v.purchase_price || 0)), 0), [variants]);
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

  const formatAmount = (val: number | string) => {
    const num = Number(val || 0);
    return num % 1 === 0 ? num.toFixed(0) : num.toFixed(2);
  };

  // ----------------------------------------------------
  // 1. DATE-WISE BREAKDOWN DATA
  // ----------------------------------------------------
  const dateStatsList = useMemo(() => {
    const dateStatsMap: {
      [key: string]: {
        dateKey: string;
        orderCount: number;
        unitsSold: number;
        revenue: number;
        discount: number;
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
          discount: 0,
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
      stat.discount += Number(s.discount_amount || 0);
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

      const v = variantsMap.get(si.variant_id);
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

    return Object.values(dateStatsMap).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [filteredSales, filteredItems, filteredExpenses, variantsMap]);

  // ----------------------------------------------------
  // 2. PRODUCT-WISE (MOTHER PRODUCT) BREAKDOWN DATA
  // ----------------------------------------------------
  const productStatsList = useMemo(() => {
    // Map of mother product id/name -> aggregated metrics
    const motherProductMap = new Map<string, MotherProductStat & { orderSet: Set<string> }>();

    // Step A: Calculate current stock & variants count for all mother products in database
    variants.forEach(v => {
      const motherId = v.product_id || v.product?.id || `name_${v.product?.name || 'unknown'}`;
      const motherName = v.product?.name || 'Unknown Product';
      const category = v.product?.category || '-';
      const brand = v.product?.brand || '-';

      if (!motherProductMap.has(motherId)) {
        motherProductMap.set(motherId, {
          productId: motherId,
          productName: motherName,
          category,
          brand,
          variantsCount: 0,
          currentStock: 0,
          unitsSold: 0,
          unitsReturned: 0,
          netUnitsSold: 0,
          grossSales: 0,
          discount: 0,
          refundAmount: 0,
          netSales: 0,
          totalCogs: 0,
          productProfit: 0,
          marginPct: 0,
          orderCount: 0,
          orderSet: new Set<string>()
        });
      }

      const entry = motherProductMap.get(motherId)!;
      entry.variantsCount += 1;
      entry.currentStock += Number(v.stock_quantity || 0);
    });

    // Step B: Aggregate sold and returned items in the selected date range
    filteredItems.forEach(si => {
      const v = variantsMap.get(si.variant_id);
      const motherId = v?.product_id || v?.product?.id || `name_${v?.product?.name || 'unknown'}`;
      const motherName = v?.product?.name || 'Unknown Product';
      const category = v?.product?.category || '-';
      const brand = v?.product?.brand || '-';

      if (!motherProductMap.has(motherId)) {
        motherProductMap.set(motherId, {
          productId: motherId,
          productName: motherName,
          category,
          brand,
          variantsCount: 1,
          currentStock: 0,
          unitsSold: 0,
          unitsReturned: 0,
          netUnitsSold: 0,
          grossSales: 0,
          discount: 0,
          refundAmount: 0,
          netSales: 0,
          totalCogs: 0,
          productProfit: 0,
          marginPct: 0,
          orderCount: 0,
          orderSet: new Set<string>()
        });
      }

      const entry = motherProductMap.get(motherId)!;
      const isReturn = si.sale_type === 'RETURN' || si.is_returned;
      const qty = Number(si.quantity || 0);
      const unitPrice = Number(si.unit_price || 0);
      const unitCost = Number(v?.purchase_price || 0);
      const totalItemAmount = Math.abs(Number(si.total_price || (qty * unitPrice) || 0));

      if (si.sale_id) {
        entry.orderSet.add(si.sale_id);
      }

      if (isReturn) {
        entry.unitsReturned += qty;
        entry.refundAmount += totalItemAmount;
        const profitImpact = qty * (unitPrice - unitCost);
        entry.productProfit -= profitImpact;
        entry.totalCogs -= qty * unitCost;
      } else {
        entry.unitsSold += qty;
        entry.grossSales += totalItemAmount;
        const profitImpact = qty * (unitPrice - unitCost);
        entry.productProfit += profitImpact;
        entry.totalCogs += qty * unitCost;

        if (si.sale?.discount_amount && Number(si.sale?.total_amount || 0) > 0) {
          const allocatedDiscount = (totalItemAmount / Number(si.sale.total_amount)) * Number(si.sale.discount_amount);
          entry.discount += allocatedDiscount;
        }
      }
    });

    // Step C: Compute final net totals and margins
    const list: MotherProductStat[] = [];
    motherProductMap.forEach(item => {
      item.netUnitsSold = item.unitsSold - item.unitsReturned;
      item.netSales = item.grossSales - item.refundAmount;
      item.orderCount = item.orderSet.size;
      item.marginPct = item.netSales > 0 ? (item.productProfit / item.netSales) * 100 : 0;

      // Only include if it has sales activity in selected range or if looking at All Time
      if (item.unitsSold > 0 || item.unitsReturned > 0 || filter === 'all') {
        list.push({
          productId: item.productId,
          productName: item.productName,
          category: item.category,
          brand: item.brand,
          variantsCount: item.variantsCount,
          currentStock: item.currentStock,
          unitsSold: item.unitsSold,
          unitsReturned: item.unitsReturned,
          netUnitsSold: item.netUnitsSold,
          grossSales: item.grossSales,
          discount: item.discount,
          refundAmount: item.refundAmount,
          netSales: item.netSales,
          totalCogs: item.totalCogs,
          productProfit: item.productProfit,
          marginPct: item.marginPct,
          orderCount: item.orderCount
        });
      }
    });

    return list;
  }, [variants, filteredItems, variantsMap, filter]);

  // Filtered & Sorted Product Stats
  const filteredProductStats = useMemo(() => {
    let result = productStatsList;
    const q = productSearchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(p => 
        p.productName.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => {
      switch (productSortBy) {
        case 'sales':
          return b.netSales - a.netSales;
        case 'profit':
          return b.productProfit - a.productProfit;
        case 'units':
          return b.netUnitsSold - a.netUnitsSold;
        case 'stock':
          return a.currentStock - b.currentStock;
        case 'name':
          return a.productName.localeCompare(b.productName);
        default:
          return b.netSales - a.netSales;
      }
    });
  }, [productStatsList, productSearchQuery, productSortBy]);

  // PDF Export Handler
  const handleDownloadPdf = () => {
    const dateRangeLabel = filter === 'all' 
      ? 'All Time' 
      : filter === 'week' 
      ? 'This Week' 
      : filter === 'month' 
      ? 'This Month' 
      : filter === 'month_select' 
      ? `Month: ${selectedMonth}` 
      : filter === 'custom' 
      ? `${startDate || 'Start'} to ${endDate || 'End'}` 
      : 'Today';

    if (reportType === 'BY_PRODUCT') {
      const totalUnitsSold = filteredProductStats.reduce((sum, p) => sum + p.netUnitsSold, 0);
      const totalProductSales = filteredProductStats.reduce((sum, p) => sum + p.netSales, 0);
      const totalProductDiscount = filteredProductStats.reduce((sum, p) => sum + p.discount, 0);
      const totalProductProfit = filteredProductStats.reduce((sum, p) => sum + p.productProfit, 0);

      exportTableToPdf({
        moduleName: 'Reports (By Product)',
        title: 'Product Sales Performance Report',
        dateRange: dateRangeLabel,
        summaryCards: [
          { label: 'Products Sold', value: String(filteredProductStats.length) },
          { label: 'Units Sold', value: `${totalUnitsSold} pcs` },
          { label: 'Total Sales', value: `Tk ${formatAmount(totalProductSales)}` },
          { label: 'Total Discount', value: `Tk ${formatAmount(totalProductDiscount)}` },
          { label: 'Product Profit', value: `Tk ${formatAmount(totalProductProfit)}` },
          { label: 'Net Profit', value: `Tk ${formatAmount(totalProductProfit)}` }
        ],
        columns: [
          { header: 'Product Name', key: 'productName' },
          { header: 'Brand', key: 'brand' },
          { header: 'Orders', key: 'orderCount', align: 'center' },
          { header: 'Units Sold', key: 'netUnitsSold', align: 'center' },
          { header: 'Total Sales', key: 'netSales', align: 'right', format: (v) => `Tk ${formatAmount(v)}` },
          { header: 'Discount', key: 'discount', align: 'right', format: (v) => `Tk ${formatAmount(v)}` },
          { header: 'Product Profit', key: 'productProfit', align: 'right', format: (v) => `Tk ${formatAmount(v)}` },
          { header: 'Net Profit', key: 'productProfit', align: 'right', format: (v) => `Tk ${formatAmount(v)}` }
        ],
        data: filteredProductStats
      });
    } else {
      exportTableToPdf({
        moduleName: 'Reports (By Date)',
        title: 'Business Performance Report (Date-wise Breakdown)',
        dateRange: dateRangeLabel,
        summaryCards: [
          { label: 'Total Sales', value: `Tk ${formatAmount(totalRevenue)}` },
          { label: 'Total Discount', value: `Tk ${formatAmount(totalDiscount)}` },
          { label: 'Returns / Refunds', value: `-Tk ${formatAmount(totalRefunds)}` },
          { label: 'Product Profit', value: `Tk ${formatAmount(totalProfit)}` },
          { label: 'Shop Expenses', value: `Tk ${formatAmount(totalExpenses)}` },
          { label: 'Net Profit', value: `Tk ${formatAmount(overallNetProfit)}` },
          { label: 'Total Orders', value: String(filteredSales.length) }
        ],
        columns: [
          { header: 'Date', key: 'dateKey', format: (v) => formatDateDisplay(v) },
          { header: 'Orders', key: 'orderCount', align: 'center' },
          { header: 'Units Sold', key: 'unitsSold', align: 'center' },
          { header: 'Total Sales', key: 'revenue', align: 'right', format: (v) => `Tk ${formatAmount(v)}` },
          { header: 'Discount', key: 'discount', align: 'right', format: (v) => `Tk ${formatAmount(v)}` },
          { header: 'Product Profit', key: 'productProfit', align: 'right', format: (v) => `Tk ${formatAmount(v)}` },
          { header: 'Expenses', key: 'expenses', align: 'right', format: (v) => `Tk ${formatAmount(v)}` },
          { header: 'Net Profit', key: 'netProfit', align: 'right', format: (v) => `Tk ${formatAmount(v)}` }
        ],
        data: dateStatsList
      });
    }
  };

  if (loading) return <div style={{ padding: '24px' }}>Loading business analytics...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      
      {/* Date Range Selector Bar */}
      <div className="reports-filter-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Business Performance Reports</h3>
          {isAdminRole(userRole) && (
            <button
              onClick={handleDownloadPdf}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0 10px', height: '28px', fontSize: '11.5px', gap: '5px', fontWeight: 700 }}
              title={`Download ${reportType === 'BY_PRODUCT' ? 'Product' : 'Date-wise'} PDF Report`}
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
              justifyContent: 'space-between',
              gap: '6px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '3px 10px',
              height: '34px',
              boxShadow: 'var(--shadow-xs)',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Select Month:</span>
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
                    padding: '2px 8px',
                    fontSize: '11.5px',
                    outline: 'none',
                    fontWeight: 600,
                    color: '#1e293b',
                    height: '24px',
                    flex: 1,
                    cursor: 'pointer'
                  }}
                />
              </div>
            </div>
          )}

          {filter === 'custom' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '3px 10px',
              height: '34px',
              boxShadow: 'var(--shadow-xs)',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1 }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>From:</span>
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
                    height: '24px',
                    width: '100%',
                    cursor: 'pointer'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1 }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>To:</span>
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
                    height: '24px',
                    width: '100%',
                    cursor: 'pointer'
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
                    height: '24px',
                    background: '#f1f5f9',
                    color: '#64748b',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    whiteSpace: 'nowrap'
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

      {/* KPI Stats Cards */}
      <div className="reports-kpi-grid">
        <div className="card" style={{ padding: '12px 14px' }}>
          <div className="card-title">Total Sales (Net)</div>
          <div className="card-value" style={{ color: 'var(--color-primary)' }}>
            ৳{formatAmount(totalRevenue)}
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div className="card-title">Total Discount</div>
          <div className="card-value" style={{ color: totalDiscount > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
            ৳{formatAmount(totalDiscount)}
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div className="card-title">Returns / Refunds</div>
          <div className="card-value" style={{ color: totalRefunds > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
            -৳{formatAmount(totalRefunds)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {totalReturnedUnits} items returned
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div className="card-title">Product Profit</div>
          <div className="card-value" style={{ color: 'var(--color-info)' }}>
            ৳{formatAmount(totalProfit)}
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div className="card-title">Shop Expenses</div>
          <div className="card-value" style={{ color: 'var(--color-danger)' }}>
            ৳{formatAmount(totalExpenses)}
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div className="card-title">Stock Valuation</div>
          <div className="card-value" style={{ color: 'var(--text-primary)' }}>
            ৳{formatAmount(totalStockValuation)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {totalStockUnits} units in stock
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div className="card-title">Net Profit</div>
          <div className="card-value" style={{ color: overallNetProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            ৳{formatAmount(overallNetProfit)}
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div className="card-title">Total Orders</div>
          <div className="card-value">{filteredSales.length}</div>
        </div>
      </div>

      {/* Report Switcher Bar (By Date vs By Product) */}
      <div className="card" style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => { setReportType('BY_DATE'); setCurrentPage(1); }}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '4px',
              border: 'none',
              background: reportType === 'BY_DATE' ? 'var(--color-primary)' : 'transparent',
              color: reportType === 'BY_DATE' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            By Date
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => { setReportType('BY_PRODUCT'); setCurrentPage(1); }}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '4px',
              border: 'none',
              background: reportType === 'BY_PRODUCT' ? 'var(--color-primary)' : 'transparent',
              color: reportType === 'BY_PRODUCT' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            By Product
          </button>
        </div>

        {reportType === 'BY_PRODUCT' && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', flex: '1 1 320px', justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search mother product or brand..."
                value={productSearchQuery}
                onChange={(e) => {
                  setProductSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ paddingLeft: '32px', height: '34px', fontSize: '12px', width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>Sort:</span>
              <select
                className="form-control"
                value={productSortBy}
                onChange={(e) => setProductSortBy(e.target.value as ProductSortKey)}
                style={{ height: '34px', fontSize: '11.5px', fontWeight: 600, width: 'auto', paddingRight: '24px' }}
              >
                <option value="sales">Highest Sales</option>
                <option value="profit">Highest Profit</option>
                <option value="units">Most Units Sold</option>
                <option value="stock">Lowest Stock</option>
                <option value="name">Product Name (A-Z)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 1. BY DATE PERFORMANCE BREAKDOWN TABLE */}
      {/* ---------------------------------------------------------------- */}
      {reportType === 'BY_DATE' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800 }}>Date-wise Performance Breakdown</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
              {dateStatsList.length} date entries
            </span>
          </div>
          
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
                      <th style={{ textAlign: 'right' }}>Discount</th>
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
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>৳{formatAmount(item.revenue)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: item.discount > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                          {item.discount > 0 ? `৳${formatAmount(item.discount)}` : '-'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-info)' }}>৳{formatAmount(item.productProfit)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: item.expenses > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                          ৳{formatAmount(item.expenses)}
                        </td>
                        <td style={{ 
                          textAlign: 'right', 
                          fontWeight: 800, 
                          color: item.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' 
                        }}>
                          ৳{formatAmount(item.netProfit)}
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
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>৳{formatAmount(item.revenue)}</div>
                      </div>

                      <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '4px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Discount</div>
                        <div style={{ fontWeight: 700, color: item.discount > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                          ৳{formatAmount(item.discount)}
                        </div>
                      </div>

                      <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '4px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Product Profit</div>
                        <div style={{ fontWeight: 800, color: 'var(--color-info)' }}>৳{formatAmount(item.productProfit)}</div>
                      </div>

                      <div style={{ 
                        background: item.netProfit >= 0 ? '#ecfdf5' : '#fef2f2', 
                        padding: '6px 8px', 
                        borderRadius: '4px',
                        border: item.netProfit >= 0 ? '1px solid #d1fae5' : '1px solid #fee2e2'
                      }}>
                        <div style={{ fontSize: '10px', color: item.netProfit >= 0 ? '#065f46' : '#991b1b', fontWeight: 600 }}>Net Profit</div>
                        <div style={{ fontWeight: 800, color: item.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          ৳{formatAmount(item.netProfit)}
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
      )}

      {/* ---------------------------------------------------------------- */}
      {/* 2. BY MOTHER PRODUCT PERFORMANCE BREAKDOWN TABLE */}
      {/* ---------------------------------------------------------------- */}
      {reportType === 'BY_PRODUCT' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800 }}>Mother Product Sales & Profitability Breakdown</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
              {filteredProductStats.length} mother products
            </span>
          </div>

          {filteredProductStats.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '28px', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
              No mother products found matching your search or time range.
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="table-container reports-desktop-table">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>Sl.</th>
                      <th>Product Name</th>
                      <th>Brand</th>
                      <th style={{ textAlign: 'center' }}>Orders</th>
                      <th style={{ textAlign: 'center' }}>Units Sold</th>
                      <th style={{ textAlign: 'right' }}>Total Sales</th>
                      <th style={{ textAlign: 'right' }}>Discount</th>
                      <th style={{ textAlign: 'right' }}>Product Profit</th>
                      <th style={{ textAlign: 'right' }}>Net Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProductStats
                      .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                      .map((prod, idx) => (
                      <tr key={prod.productId}>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                          {(currentPage - 1) * pageSize + idx + 1}
                        </td>
                        <td style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--text-primary)' }}>
                          {prod.productName}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          {prod.brand && prod.brand !== '-' ? prod.brand : '-'}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>
                          {prod.orderCount}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: prod.netUnitsSold > 0 ? 'var(--color-primary)' : 'var(--text-muted)' }}>
                          {prod.netUnitsSold} pcs
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                          ৳{formatAmount(prod.netSales)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: prod.discount > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                          {prod.discount > 0 ? `৳${formatAmount(prod.discount)}` : '-'}
                        </td>
                        <td style={{ 
                          textAlign: 'right', 
                          fontWeight: 700, 
                          color: 'var(--color-info)' 
                        }}>
                          ৳{formatAmount(prod.productProfit)}
                        </td>
                        <td style={{ 
                          textAlign: 'right', 
                          fontWeight: 800, 
                          color: prod.productProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' 
                        }}>
                          ৳{formatAmount(prod.productProfit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View for Products */}
              <div className="reports-mobile-cards">
                {filteredProductStats
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((prod, idx) => (
                  <div 
                    key={prod.productId}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginRight: '6px' }}>
                          #{(currentPage - 1) * pageSize + idx + 1}
                        </span>
                        <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>
                          {prod.productName}
                        </span>
                        {prod.brand && prod.brand !== '-' && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: 600 }}>
                            Brand: {prod.brand}
                          </div>
                        )}
                      </div>
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: 700, 
                        background: 'var(--color-primary-light)', 
                        color: 'var(--color-primary)', 
                        padding: '2px 7px', 
                        borderRadius: '4px' 
                      }}>
                        {prod.orderCount} orders · {prod.netUnitsSold} pcs
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11.5px' }}>
                      <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '4px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Total Sales</div>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>৳{formatAmount(prod.netSales)}</div>
                      </div>

                      <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '4px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Discount</div>
                        <div style={{ fontWeight: 700, color: prod.discount > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                          ৳{formatAmount(prod.discount)}
                        </div>
                      </div>

                      <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '4px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Product Profit</div>
                        <div style={{ fontWeight: 800, color: 'var(--color-info)' }}>৳{formatAmount(prod.productProfit)}</div>
                      </div>

                      <div style={{ 
                        background: prod.productProfit >= 0 ? '#ecfdf5' : '#fef2f2', 
                        padding: '6px 8px', 
                        borderRadius: '4px',
                        border: prod.productProfit >= 0 ? '1px solid #d1fae5' : '1px solid #fee2e2'
                      }}>
                        <div style={{ fontSize: '10px', color: prod.productProfit >= 0 ? '#065f46' : '#991b1b', fontWeight: 600 }}>Net Profit</div>
                        <div style={{ fontWeight: 800, color: prod.productProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          ৳{formatAmount(prod.productProfit)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Pagination 
                currentPage={currentPage}
                totalItems={filteredProductStats.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </>
          )}
        </div>
      )}

    </div>
  );
};
