import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import type { ProductVariant } from '../store';
import { DollarSign, ShoppingBag, Calendar, Package, Receipt, Boxes, RotateCcw } from 'lucide-react';
import { Pagination } from './Pagination';

type DateFilter = 'today' | 'week' | 'month' | 'all';

export const ReportsView: React.FC = () => {
  const [sales, setSales] = useState<any[]>([]);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Date filter & pagination state
  const [filter, setFilter] = useState<DateFilter>('today');
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
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString(undefined, {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
      return dateKey;
    } catch {
      return dateKey;
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

  if (loading) return <div style={{ padding: '24px' }}>Loading business analytics...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      
      {/* Date Range Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Business Performance Reports</h3>
        <div style={{
          display: 'flex',
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '3px',
          gap: '3px',
          boxShadow: 'var(--shadow-xs)'
        }}>
          {(['today', 'week', 'month', 'all'] as const).map(option => (
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
              <span style={{ textTransform: 'capitalize' }}>
                {option === 'all' ? 'All Time' : option === 'week' ? 'This Week' : option === 'month' ? 'This Month' : option}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
        
        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title">Total Sales</div>
              <div className="card-value">৳{totalRevenue.toFixed(2)}</div>
            </div>
            <span style={{ background: 'rgba(11, 37, 69, 0.08)', color: 'var(--color-primary)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
              <DollarSign size={18} />
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title">Returns / Refunds</div>
              <div className="card-value" style={{ color: totalRefunds > 0 ? '#dc2626' : 'var(--text-muted)' }}>
                {totalRefunds > 0 ? `-৳${totalRefunds.toFixed(2)}` : '৳0.00'}
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {totalReturnedUnits} pcs returned
              </div>
            </div>
            <span style={{ background: '#fee2e2', color: '#dc2626', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
              <RotateCcw size={18} />
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title">Product Profit</div>
              <div className="card-value" style={{ color: 'var(--color-info)' }}>
                ৳{totalProfit.toFixed(2)}
              </div>
            </div>
            <span style={{ background: 'rgba(2, 132, 199, 0.08)', color: 'var(--color-info)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
              <Package size={18} />
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title">Shop Expenses</div>
              <div className="card-value" style={{ color: 'var(--color-danger)' }}>
                ৳{totalExpenses.toFixed(2)}
              </div>
            </div>
            <span style={{ background: 'rgba(225, 29, 72, 0.08)', color: 'var(--color-danger)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
              <Receipt size={18} />
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title">Stock Valuation</div>
              <div className="card-value" style={{ color: 'var(--text-primary)' }}>
                ৳{totalStockValuation.toFixed(2)}
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {totalStockUnits} units in stock
              </div>
            </div>
            <span style={{ background: 'rgba(11, 37, 69, 0.08)', color: 'var(--color-primary)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
              <Boxes size={18} />
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title">Net Profit</div>
              <div className="card-value" style={{ color: overallNetProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                ৳{overallNetProfit.toFixed(2)}
              </div>
            </div>
            <span style={{ 
              background: overallNetProfit >= 0 ? 'rgba(5, 150, 105, 0.08)' : 'rgba(225, 29, 72, 0.08)', 
              color: overallNetProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)', 
              padding: '8px', 
              borderRadius: 'var(--radius-sm)' 
            }}>
              <DollarSign size={18} />
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title">Total Orders</div>
              <div className="card-value">{filteredSales.length}</div>
            </div>
            <span style={{ background: 'rgba(148, 163, 184, 0.08)', color: 'var(--text-secondary)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
              <ShoppingBag size={18} />
            </span>
          </div>
        </div>

      </div>

      {/* Date-wise Performance Breakdown Table */}
      <div>
        <h3 style={{ marginBottom: '10px', fontSize: '14px', fontWeight: 800 }}>Date-wise Performance Breakdown</h3>
        <div className="table-container">
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
              {dateStatsList.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
                    No sales or expense activity recorded for this time range.
                  </td>
                </tr>
              ) : (
                dateStatsList
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
                ))
              )}
            </tbody>
          </table>
          <Pagination 
            currentPage={currentPage}
            totalItems={dateStatsList.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

    </div>
  );
};
