import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import type { ProductVariant } from '../store';
import { DollarSign, ShoppingBag, Calendar, Package, Receipt, Truck } from 'lucide-react';
import { Pagination } from './Pagination';

type DateFilter = 'today' | 'week' | 'month' | 'all';

export const ReportsView: React.FC = () => {
  const [sales, setSales] = useState<any[]>([]);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Date filter & pagination state
  const [filter, setFilter] = useState<DateFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadData = async () => {
    try {
      setLoading(true);
      const [salesList, itemsList, variantList, expenseList, purchaseList] = await Promise.all([
        dbService.getSales(),
        dbService.getSaleItemsDetailed(),
        dbService.getVariants(),
        dbService.getExpenses(),
        dbService.getPurchases()
      ]);
      
      setSales(salesList);
      setSaleItems(itemsList);
      setVariants(variantList);
      setExpenses(expenseList);
      setPurchases(purchaseList);
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
  const filteredPurchases = purchases.filter(p => filterByDate(p.purchase_date));

  // Compute stats
  const totalRevenue = filteredSales.reduce((acc, s) => acc + Number(s.payable_amount), 0);
  
  let totalProfit = 0; // Gross profit (Revenue - COGS)
  filteredItems.forEach(si => {
    const v = variants.find(x => x.id === si.variant_id);
    if (v) {
      totalProfit += (si.quantity * (si.unit_price - v.purchase_price));
    }
  });

  const totalExpenses = filteredExpenses.reduce((acc, exp) => acc + Number(exp.amount), 0);
  const totalPurchases = filteredPurchases.reduce((acc, p) => acc + Number(p.total_amount), 0);
  const overallNetProfit = totalProfit - totalExpenses;

  // Compute Top Selling Products & Product-wise Breakdown
  const productStatsMap: { [key: string]: { name: string; sku: string; barcode: string; size: string; color: string; qty: number; revenue: number; profit: number } } = {};

  filteredItems.forEach(si => {
    const v = variants.find(x => x.id === si.variant_id);
    if (v) {
      const key = v.id;
      const profitVal = si.quantity * (si.unit_price - v.purchase_price);
      if (productStatsMap[key]) {
        productStatsMap[key].qty += si.quantity;
        productStatsMap[key].revenue += si.total_price;
        productStatsMap[key].profit += profitVal;
      } else {
        productStatsMap[key] = {
          name: v.product?.name || 'Unknown Product',
          sku: v.sku,
          barcode: v.barcode,
          size: v.size,
          color: v.color,
          qty: si.quantity,
          revenue: si.total_price,
          profit: profitVal
        };
      }
    }
  });

  const productStatsList = Object.values(productStatsMap).sort((a, b) => b.qty - a.qty);
  const topSellingList = productStatsList.slice(0, 5);

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
              onClick={() => setFilter(option)}
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
              <div className="card-title">Total Purchases</div>
              <div className="card-value" style={{ color: 'var(--text-primary)' }}>
                ৳{totalPurchases.toFixed(2)}
              </div>
            </div>
            <span style={{ background: 'rgba(11, 37, 69, 0.08)', color: 'var(--color-primary)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
              <Truck size={18} />
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

      {/* Top Selling Products */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0 }}>Top Selling Items</h3>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-primary)', padding: '2px 8px', borderRadius: '12px' }}>Top 5</span>
        </div>
        {topSellingList.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontSize: '12.5px' }}>
            No sales recorded for this date filter.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {topSellingList.map((item, idx) => {
              const maxQty = topSellingList[0].qty;
              const percentage = (item.qty / maxQty) * 100;
              const rankColors = ['#d97706', '#64748b', '#b45309', 'var(--text-muted)', 'var(--text-muted)'];
              const rankBg = ['rgba(217,119,6,0.1)', 'rgba(100,116,139,0.1)', 'rgba(180,83,9,0.1)', 'rgba(148,163,184,0.06)', 'rgba(148,163,184,0.06)'];
              return (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  background: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-sm)',
                  border: idx === 0 ? '1px solid rgba(217,119,6,0.2)' : '1px solid transparent'
                }}>
                  {/* Rank Badge */}
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: rankBg[idx] || rankBg[4],
                    color: rankColors[idx] || rankColors[4],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '11.5px',
                    flexShrink: 0
                  }}>
                    #{idx + 1}
                  </div>

                  {/* Product Info + Bar */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                          {item.size} · {item.color} · {item.sku}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-primary)' }}>{item.qty} units</div>
                        <div style={{ fontSize: '10.5px', color: 'var(--color-success)', fontWeight: 600 }}>৳{item.revenue.toFixed(0)}</div>
                      </div>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${percentage}%`,
                        height: '100%',
                        background: 'var(--color-primary)',
                        borderRadius: '2px',
                        opacity: 1 - idx * 0.12
                      }}></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Product-wise Sales Breakdown Table */}
      <div>
        <h3 style={{ marginBottom: '10px', fontSize: '14px', fontWeight: 800 }}>Product-wise Sales Breakdown</h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>Sl.</th>
                <th>Clothing Product</th>
                <th>SKU</th>
                <th>Barcode</th>
                <th>Size/Color</th>
                <th style={{ textAlign: 'center' }}>Units Sold</th>
                <th style={{ textAlign: 'right' }}>Revenue</th>
                <th style={{ textAlign: 'right' }}>Total Profit</th>
              </tr>
            </thead>
            <tbody>
              {productStatsList.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
                    No products sold in this time range.
                  </td>
                </tr>
              ) : (
                productStatsList
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {(currentPage - 1) * pageSize + idx + 1}
                    </td>
                    <td style={{ fontWeight: 600, fontSize: '12.5px' }}>{item.name}</td>
                    <td style={{ fontSize: '12px' }}>{item.sku}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>{item.barcode}</td>
                    <td style={{ fontSize: '12px' }}>{item.size} / {item.color}</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.qty}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>৳{item.revenue.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-success)' }}>৳{item.profit.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <Pagination 
            currentPage={currentPage}
            totalItems={productStatsList.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

    </div>
  );
};
