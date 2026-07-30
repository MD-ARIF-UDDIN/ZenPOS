import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import type { ProductVariant } from '../store';
import { DollarSign, ShoppingBag, Calendar, Package, Receipt, Truck } from 'lucide-react';

type DateFilter = 'today' | 'week' | 'month' | 'all';

export const ReportsView: React.FC = () => {
  const [sales, setSales] = useState<any[]>([]);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Date filter state
  const [filter, setFilter] = useState<DateFilter>('all');

  const loadData = async () => {
    try {
      setLoading(true);
      const salesList = await dbService.getSales();
      const itemsList = await dbService.getSaleItemsDetailed();
      const variantList = await dbService.getVariants();
      const expenseList = await dbService.getExpenses();
      const purchaseList = await dbService.getPurchases();
      
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* Filters Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        
        {/* Time filters buttons */}
        <div style={{
          display: 'flex',
          background: '#ffffff',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '4px',
          gap: '4px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          {(['today', 'week', 'month', 'all'] as const).map(option => (
            <button
              key={option}
              className="btn"
              onClick={() => setFilter(option)}
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                borderRadius: '8px',
                background: filter === option ? 'var(--color-primary)' : 'transparent',
                color: filter === option ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 700,
                boxShadow: filter === option ? 'var(--shadow-sm)' : 'none',
                height: '34px'
              }}
            >
              <Calendar size={12} style={{ marginRight: '6px', verticalAlign: 'middle', display: 'inline' }} />
              <span style={{ textTransform: 'capitalize' }}>
                {option === 'all' ? 'All Time' : option === 'week' ? 'This Week' : option === 'month' ? 'This Month' : option}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <div className="card-title">Total Sales</div>
              <div className="card-value">৳{totalRevenue.toFixed(2)}</div>
            </div>
            <span style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-primary)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
              <DollarSign size={24} />
            </span>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <div className="card-title">Product Profit</div>
              <div className="card-value" style={{ color: 'var(--color-info)' }}>
                ৳{totalProfit.toFixed(2)}
              </div>
            </div>
            <span style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'var(--color-info)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
              <Package size={24} />
            </span>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <div className="card-title">Shop Expenses</div>
              <div className="card-value" style={{ color: 'var(--color-danger)' }}>
                ৳{totalExpenses.toFixed(2)}
              </div>
            </div>
            <span style={{ background: 'rgba(244, 63, 94, 0.1)', color: 'var(--color-danger)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
              <Receipt size={24} />
            </span>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <div className="card-title">Total Purchases</div>
              <div className="card-value" style={{ color: 'var(--text-primary)' }}>
                ৳{totalPurchases.toFixed(2)}
              </div>
            </div>
            <span style={{ background: 'rgba(13, 148, 136, 0.1)', color: 'var(--color-primary)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
              <Truck size={24} />
            </span>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <div className="card-title">Net Profit</div>
              <div className="card-value" style={{ color: overallNetProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                ৳{overallNetProfit.toFixed(2)}
              </div>
            </div>
            <span style={{ 
              background: overallNetProfit >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)', 
              color: overallNetProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)', 
              padding: '12px', 
              borderRadius: 'var(--radius-md)' 
            }}>
              <DollarSign size={24} />
            </span>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <div className="card-title">Total Orders</div>
              <div className="card-value">{filteredSales.length}</div>
            </div>
            <span style={{ background: 'rgba(148, 163, 184, 0.1)', color: 'var(--text-secondary)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
              <ShoppingBag size={24} />
            </span>
          </div>
        </div>

      </div>

      {/* Top Selling Products */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Top Selling Items</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-primary)', padding: '4px 10px', borderRadius: '20px' }}>Top 5</span>
        </div>
        {topSellingList.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px', fontSize: '13px' }}>
            No sales recorded for this date filter.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topSellingList.map((item, idx) => {
              const maxQty = topSellingList[0].qty;
              const percentage = (item.qty / maxQty) * 100;
              const rankColors = ['#f59e0b', '#94a3b8', '#cd7c2f', 'var(--text-muted)', 'var(--text-muted)'];
              const rankBg = ['rgba(245,158,11,0.12)', 'rgba(148,163,184,0.12)', 'rgba(205,124,47,0.12)', 'rgba(148,163,184,0.08)', 'rgba(148,163,184,0.08)'];
              return (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '12px 14px',
                  background: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-sm)',
                  border: idx === 0 ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent'
                }}>
                  {/* Rank Badge */}
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: rankBg[idx] || rankBg[4],
                    color: rankColors[idx] || rankColors[4],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '13px',
                    flexShrink: 0
                  }}>
                    #{idx + 1}
                  </div>

                  {/* Product Info + Bar */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                          {item.size} · {item.color} · {item.sku}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)' }}>{item.qty} units</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 600 }}>৳{item.revenue.toFixed(0)}</div>
                      </div>
                    </div>
                    <div style={{ width: '100%', height: '5px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${percentage}%`,
                        height: '100%',
                        background: idx === 0 ? 'linear-gradient(90deg, var(--color-primary), var(--color-success))' : 'var(--color-primary)',
                        borderRadius: '3px',
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
        <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 700 }}>Product-wise Sales Breakdown</h3>
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
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                    No products sold in this time range.
                  </td>
                </tr>
              ) : (
                productStatsList.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{item.name}</td>
                    <td>{item.sku}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-secondary)' }}>{item.barcode}</td>
                    <td>{item.size} / {item.color}</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.qty}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>৳{item.revenue.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-success)' }}>৳{item.profit.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
