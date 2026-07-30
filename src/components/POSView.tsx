import React, { useState, useEffect, useRef } from 'react';
import { usePOSStore, useNotificationStore } from '../store';
import type { ProductVariant } from '../store';
import { dbService } from '../dbService';
import { Search, Trash2, Plus, Minus, CreditCard, DollarSign, Smartphone, Printer, CheckCircle } from 'lucide-react';

interface POSViewProps {
  onRefreshStats: () => void;
}

export const POSView: React.FC<POSViewProps> = ({ onRefreshStats }) => {
  const { showToast } = useNotificationStore();
  const { 
    cart, 
    discount, 
    paymentMethod, 
    receivedAmount, 
    addToCart, 
    removeFromCart, 
    updateCartQty, 
    updateCartPrice,
    clearCart, 
    setDiscount, 
    setPaymentMethod, 
    setReceivedAmount 
  } = usePOSStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [searchResults, setSearchResults] = useState<ProductVariant[]>([]);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentRows, setPaymentRows] = useState<{ method: string; amount: number }[]>([{ method: 'CASH', amount: 0 }]);
  const [checkingOut, setCheckingOut] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load all product variants for scanning lookup
  const loadVariants = async () => {
    const list = await dbService.getVariants();
    setVariants(list);
  };

  useEffect(() => {
    loadVariants();
  }, []);

  // Keyboard shortcut listener to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search on Ctrl + F
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Search logic (name, barcode, SKU)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const filtered = variants.filter(v => 
      v.barcode === searchQuery || // Exact barcode match
      v.sku.toLowerCase().includes(q) ||
      v.product?.name.toLowerCase().includes(q)
    );
    setSearchResults(filtered);
  }, [searchQuery, variants]);

  // Handle barcode scanner input (which usually acts as keyboard + Enter)
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Search for exact barcode match first
    const exactMatch = variants.find(v => v.barcode === searchQuery);
    if (exactMatch) {
      if (exactMatch.stock_quantity <= 0) {
        showToast(`Warning: ${exactMatch.product?.name} (${exactMatch.color}/${exactMatch.size}) is out of stock!`, 'warning');
      }
      addToCart(exactMatch);
      setSearchQuery('');
    } else if (searchResults.length === 1) {
      // If only one result, add it
      if (searchResults[0].stock_quantity <= 0) {
        showToast(`Warning: ${searchResults[0].product?.name} (${searchResults[0].color}/${searchResults[0].size}) is out of stock!`, 'warning');
      }
      addToCart(searchResults[0]);
      setSearchQuery('');
    }
  };

  const handleResultClick = (v: ProductVariant) => {
    if (v.stock_quantity <= 0) {
      showToast(`Warning: ${v.product?.name} (${v.color}/${v.size}) is out of stock!`, 'warning');
    }
    addToCart(v);
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + (item.quantity * (item.customPrice !== undefined ? item.customPrice : item.variant.selling_price)), 0);
  const payableAmount = Math.max(0, subtotal - discount);
  const totalReceived = paymentRows.reduce((acc, r) => acc + (r.amount || 0), 0);
  const changeAmount = totalReceived > payableAmount ? totalReceived - payableAmount : 0;
  const dueAmount = totalReceived < payableAmount ? payableAmount - totalReceived : 0;

  const addPaymentRow = () => {
    const usedMethods = paymentRows.map(r => r.method);
    const available = ['CASH', 'CARD', 'BKASH', 'NAGAD', 'ROCKET'].find(m => !usedMethods.includes(m));
    if (available) setPaymentRows(prev => [...prev, { method: available, amount: 0 }]);
  };
  const removePaymentRow = (idx: number) => setPaymentRows(prev => prev.filter((_, i) => i !== idx));
  const updatePaymentRow = (idx: number, field: 'method' | 'amount', value: string | number) =>
    setPaymentRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  const fillRemaining = (idx: number) => {
    const otherTotal = paymentRows.reduce((acc, r, i) => i !== idx ? acc + (r.amount || 0) : acc, 0);
    const remaining = Math.max(0, payableAmount - otherTotal);
    updatePaymentRow(idx, 'amount', remaining);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    const hasCash = paymentRows.some(r => r.method === 'CASH' && r.amount > 0);
    if (totalReceived <= 0) {
      showToast('Please enter at least one payment amount.', 'warning');
      return;
    }

    // Determine label: single method or SPLIT
    const activeMethods = paymentRows.filter(r => r.amount > 0).map(r => r.method);
    const finalMethod = activeMethods.length === 1 ? activeMethods[0] : 'SPLIT';
    const finalReceived = totalReceived;

    try {
      setCheckingOut(true);
      showToast('Processing checkout...', 'info');
      const saleId = await dbService.checkoutSale(
        cart,
        discount,
        finalMethod,
        finalReceived,
        customerPhone
      );
      setCheckoutSuccess(saleId);
      setShowReceipt(true);
      onRefreshStats();
      loadVariants();
      showToast('Checkout completed successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to complete sale', 'error');
    } finally {
      setCheckingOut(false);
    }
  };

  const handleNewSale = () => {
    clearCart();
    setCheckoutSuccess(null);
    setShowReceipt(false);
    setSearchQuery('');
    setCustomerPhone('');
    setPaymentRows([{ method: 'CASH', amount: 0 }]);
    searchInputRef.current?.focus();
  };

  return (
    <div className="pos-layout">
      {/* LEFT: Cart & Product Scanner */}
      <div className="pos-main">
        {/* Search & Barcode scanning input */}
        <div className="card" style={{ padding: '16px' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)' }} />
              <input
                ref={searchInputRef}
                type="text"
                className="form-control"
                placeholder="Scan barcode or type name/SKU... (Ctrl+F to focus)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '44px', width: '100%', height: '46px' }}
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ height: '46px' }}>Enter</button>

            {/* Quick dropdown for name matching */}
            {searchResults.length > 0 && searchQuery !== searchResults[0].barcode && (
              <div style={{
                position: 'absolute',
                top: '52px',
                left: 0,
                right: 0,
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                zIndex: 100,
                maxHeight: '250px',
                overflowY: 'auto',
                boxShadow: 'var(--shadow-lg)'
              }}>
                {searchResults.map(v => (
                  <div 
                    key={v.id} 
                    onClick={() => handleResultClick(v)}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    className="search-item-row"
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{v.product?.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        SKU: {v.sku} | Color: {v.color} | Size: {v.size} | Barcode: {v.barcode}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>৳{v.selling_price.toFixed(2)}</div>
                      <div style={{ fontSize: '11px', color: v.stock_quantity > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        Stock: {v.stock_quantity}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </form>
        </div>

        {/* Featured Products Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Featured Items (Quick Add)
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
            {variants.slice(0, 4).map(v => (
              <div 
                key={v.id}
                onClick={() => handleResultClick(v)}
                className="card"
                style={{
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                  background: '#fff',
                  border: '1px solid var(--border-color)',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                  {v.product?.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 6px 0' }}>
                  {v.size} / {v.color}
                </div>
                <div style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: '14px' }}>
                  ৳{v.selling_price.toFixed(2)}
                </div>
                <span style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  marginTop: '4px',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  background: v.stock_quantity > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                  color: v.stock_quantity > 0 ? 'var(--color-success)' : 'var(--color-danger)'
                }}>
                  {v.stock_quantity > 0 ? `Stock: ${v.stock_quantity}` : 'Out of Stock'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Cart Listing */}
        <div className="desktop-cart-table table-container" style={{ flex: 1, overflowY: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Item Details</th>
                <th style={{ width: '100px' }}>Size/Color</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Price</th>
                <th style={{ width: '150px', textAlign: 'center' }}>Qty</th>
                <th style={{ width: '120px', textAlign: 'right' }}>Total</th>
                <th style={{ width: '60px' }}></th>
              </tr>
            </thead>
            <tbody>
              {cart.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                    Cart is empty. Scan products or search to add them.
                  </td>
                </tr>
              ) : (
                cart.map(item => (
                  <tr key={item.variant.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.variant.product?.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        SKU: {item.variant.sku} | BC: {item.variant.barcode}
                      </div>
                    </td>
                    <td>
                      <span style={{
                        background: 'var(--bg-primary)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        marginRight: '4px'
                      }}>{item.variant.size}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.variant.color}</span>
                    </td>
                    <td style={{ textAlign: 'center', width: '130px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>৳</span>
                        <input
                          type="number"
                          className="form-control"
                          value={item.customPrice !== undefined ? item.customPrice : item.variant.selling_price}
                          onChange={(e) => updateCartPrice(item.variant.id, Number(e.target.value))}
                          style={{ width: '80px', height: '34px', padding: '4px 8px', fontSize: '13px', textAlign: 'center' }}
                        />
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '4px 8px', borderRadius: '4px' }}
                          onClick={() => updateCartQty(item.variant.id, item.quantity - 1)}
                        >
                          <Minus size={12} />
                        </button>
                        <span style={{ minWidth: '24px', fontWeight: 'bold' }}>{item.quantity}</span>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '4px 8px', borderRadius: '4px' }}
                          onClick={() => {
                            if (item.quantity >= item.variant.stock_quantity) {
                              showToast(`Warning: Only ${item.variant.stock_quantity} units available in stock.`, 'warning');
                            }
                            updateCartQty(item.variant.id, item.quantity + 1);
                          }}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      ৳{(item.quantity * (item.customPrice !== undefined ? item.customPrice : item.variant.selling_price)).toFixed(2)}
                    </td>
                    <td>
                      <button 
                        className="btn btn-danger" 
                        style={{ padding: '6px', borderRadius: '4px' }}
                        onClick={() => removeFromCart(item.variant.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cart View (Cards instead of Table) */}
        <div className="mobile-cart-list" style={{ flexDirection: 'column', gap: '12px' }}>
          {cart.length === 0 ? (
            <div className="card" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Cart is empty. Scan products or search to add them.
            </div>
          ) : (
            cart.map(item => (
              <div className="card" key={item.variant.id} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>{item.variant.product?.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      SKU: {item.variant.sku} | BC: {item.variant.barcode}
                    </div>
                  </div>
                  <button 
                    className="btn btn-danger" 
                    style={{ padding: '6px', borderRadius: '4px' }}
                    onClick={() => removeFromCart(item.variant.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  {/* Size & Color */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>{item.variant.size}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.variant.color}</span>
                  </div>

                  {/* Edit Price input */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Price:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>৳</span>
                      <input
                        type="number"
                        className="form-control"
                        value={item.customPrice !== undefined ? item.customPrice : item.variant.selling_price}
                        onChange={(e) => updateCartPrice(item.variant.id, Number(e.target.value))}
                        style={{ width: '80px', height: '34px', padding: '4px 8px', fontSize: '13px', textAlign: 'center' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px' }}>
                  {/* Quantity selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '4px 8px', borderRadius: '4px' }}
                      onClick={() => updateCartQty(item.variant.id, item.quantity - 1)}
                    >
                      <Minus size={12} />
                    </button>
                    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{item.quantity}</span>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '4px 8px', borderRadius: '4px' }}
                      onClick={() => {
                        if (item.quantity >= item.variant.stock_quantity) {
                          showToast(`Warning: Only ${item.variant.stock_quantity} units available in stock.`, 'warning');
                        }
                        updateCartQty(item.variant.id, item.quantity + 1);
                      }}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  
                  {/* Total */}
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-primary)' }}>
                    ৳{(item.quantity * (item.customPrice !== undefined ? item.customPrice : item.variant.selling_price)).toFixed(2)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT: Checkout Sidebar */}
      <div className="pos-sidebar">
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>
          Sale Summary
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
          
          {/* Subtotal */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
            <span style={{ fontWeight: 'bold' }}>৳{subtotal.toFixed(2)}</span>
          </div>

          {/* Customer Phone Input */}
          <div className="form-group">
            <label className="form-label">Customer Phone</label>
            <input 
              type="text" 
              className="form-control" 
              value={customerPhone} 
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="e.g. 01712345678"
            />
          </div>

          {/* Discount Input */}
          <div className="form-group">
            <label className="form-label">Discount Amount (৳)</label>
            <input 
              type="number" 
              className="form-control" 
              value={discount || ''} 
              onChange={(e) => setDiscount(Number(e.target.value))}
              placeholder="0.00"
            />
          </div>

          {/* Payable Total */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '16px', 
            background: 'var(--bg-primary)', 
            borderRadius: 'var(--radius-md)' 
          }}>
            <span style={{ fontWeight: 600 }}>Total Payable:</span>
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-primary)' }}>
              ৳{payableAmount.toFixed(2)}
            </span>
          </div>

          {/* Payment Section */}
          <div className="form-group">
            <label className="form-label" style={{ marginBottom: '10px', display: 'block' }}>Payment Method</label>

            {/* Method pill toggles */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
              {[
                { label: 'Cash', value: 'CASH',   bg: '#16a34a', light: 'rgba(22,163,74,0.1)',   text: '#fff', icon: '💵' },
                { label: 'Card', value: 'CARD',   bg: '#2563eb', light: 'rgba(37,99,235,0.1)',   text: '#fff', icon: '💳' },
                { label: 'bKash', value: 'BKASH', bg: '#e2136e', light: 'rgba(226,19,110,0.1)', text: '#fff', icon: '🅱' },
                { label: 'Nagad', value: 'NAGAD', bg: '#f97316', light: 'rgba(249,115,22,0.1)', text: '#fff', icon: '🅽' },
                { label: 'Rocket', value: 'ROCKET', bg: '#7c3aed', light: 'rgba(124,58,237,0.1)', text: '#fff', icon: '🚀' },
              ].map(opt => {
                const isActive = paymentRows.some(r => r.method === opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      if (isActive) {
                        if (paymentRows.length > 1) removePaymentRow(paymentRows.findIndex(r => r.method === opt.value));
                        else updatePaymentRow(0, 'method', opt.value); // keep at least 1
                      } else {
                        const emptyRow = paymentRows.findIndex(r => r.amount === 0 && !paymentRows.some((o, oi) => oi !== paymentRows.indexOf(r) && o.method === r.method));
                        if (paymentRows.length === 1 && paymentRows[0].amount === 0) {
                          updatePaymentRow(0, 'method', opt.value);
                        } else {
                          setPaymentRows(prev => [...prev, { method: opt.value, amount: 0 }]);
                        }
                      }
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '24px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: isActive ? `2px solid ${opt.bg}` : '2px solid var(--border-color)',
                      background: isActive ? opt.bg : opt.light,
                      color: isActive ? opt.text : opt.bg,
                      transition: 'all 0.15s',
                      boxShadow: isActive ? `0 2px 8px ${opt.bg}40` : 'none'
                    }}
                  >
                    <span style={{ fontSize: '15px' }}>{opt.icon}</span>
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Amount inputs for active methods */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {paymentRows.map((row, idx) => {
                const meta: Record<string, { label: string; color: string }> = {
                  CASH:   { label: 'Cash',   color: '#16a34a' },
                  CARD:   { label: 'Card',   color: '#2563eb' },
                  BKASH:  { label: 'bKash',  color: '#e2136e' },
                  NAGAD:  { label: 'Nagad',  color: '#f97316' },
                  ROCKET: { label: 'Rocket', color: '#7c3aed' },
                };
                const m = meta[row.method] || { label: row.method, color: 'var(--color-primary)' };
                return (
                  <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{
                      width: '62px', flexShrink: 0, fontSize: '12px', fontWeight: 700,
                      color: m.color, textAlign: 'right'
                    }}>{m.label}</span>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--text-muted)', fontSize: '13px' }}>৳</span>
                      <input
                        type="number"
                        className="form-control"
                        value={row.amount || ''}
                        onChange={e => updatePaymentRow(idx, 'amount', Number(e.target.value))}
                        placeholder="0.00"
                        style={{ paddingLeft: '26px', fontSize: '15px', fontWeight: 700, borderColor: m.color + '60' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => fillRemaining(idx)}
                      title="Fill remaining"
                      style={{ padding: '8px 10px', fontSize: '11px', fontWeight: 700, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', color: m.color, flexShrink: 0 }}
                    >
                      Fill
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary row */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px 14px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Total Received</span>
              <span style={{ fontWeight: 700 }}>৳{totalReceived.toFixed(2)}</span>
            </div>
            {changeAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Change to Return</span>
                <span style={{ color: 'var(--color-success)', fontWeight: 700, fontSize: '15px' }}>৳{changeAmount.toFixed(2)}</span>
              </div>
            )}
            {dueAmount > 0 && totalReceived > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>Customer Due</span>
                <span style={{ color: 'var(--color-danger)', fontWeight: 700, fontSize: '15px' }}>৳{dueAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Checkout Button */}
          <button
            onClick={handleCheckout}
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', borderRadius: 'var(--radius-md)', fontSize: '16px', marginTop: 'auto' }}
            disabled={cart.length === 0 || checkingOut}
          >
            {checkingOut ? 'Checking out...' : 'Checkout Sale'}
          </button>
        </div>
      </div>

      {/* RECEIPT MODAL */}
      {showReceipt && checkoutSuccess && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '90%', maxWidth: '400px', backgroundColor: 'white', color: 'black', padding: '24px', borderRadius: 'var(--radius-md)' }}>
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #ccc', paddingBottom: '16px', marginBottom: '16px' }}>
              <CheckCircle size={44} style={{ color: 'var(--color-success)', marginBottom: '8px' }} />
              <h3 style={{ margin: '8px 0', fontSize: '28px', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '1px', textTransform: 'uppercase' }}>RAJMAHAL</h3>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Premium Clothing Store</p>
              <p style={{ fontSize: '12px', color: '#94a3b8' }}>POS Terminal Invoice</p>
            </div>
            
            <div style={{ fontSize: '12px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Invoice ID:</span>
                <span style={{ fontWeight: 'bold' }}>{checkoutSuccess.toUpperCase()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Date/Time:</span>
                <span>{new Date().toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Payment Mode:</span>
                <span style={{ fontWeight: 'bold' }}>{paymentMethod}</span>
              </div>
              {customerPhone && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Customer Phone:</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{customerPhone}</span>
                </div>
              )}
            </div>

            <div style={{ borderBottom: '1px dashed #ccc', paddingBottom: '12px', marginBottom: '12px' }}>
              {cart.map(item => (
                <div key={item.variant.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <span>{item.variant.product?.name} ({item.variant.size}/{item.variant.color}) x {item.quantity}</span>
                  <span>৳{(item.quantity * (item.customPrice !== undefined ? item.customPrice : item.variant.selling_price)).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal:</span>
                <span>৳{subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'red' }}>
                  <span>Discount:</span>
                  <span>-৳{discount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid #eee', paddingTop: '8px' }}>
                <span>Total Payable:</span>
                <span>৳{payableAmount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>Amount Received:</span>
                <span>৳{totalReceived.toFixed(2)}</span>
              </div>
              
              {/* Payment Methods Breakdown */}
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', borderTop: '1px dashed #eee', paddingTop: '4px', marginTop: '4px', marginBottom: '4px' }}>
                {paymentRows.filter(r => r.amount > 0).map(r => {
                  const labelMap: Record<string, string> = {
                    CASH: 'Cash',
                    CARD: 'Card',
                    BKASH: 'bKash',
                    NAGAD: 'Nagad',
                    ROCKET: 'Rocket'
                  };
                  return (
                    <div key={r.method} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span>Paid via {labelMap[r.method] || r.method}:</span>
                      <span>৳{r.amount.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>

              {dueAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: 'var(--color-danger)', fontSize: '14px', borderTop: '1px solid #eee', paddingTop: '4px' }}>
                  <span>Due Balance:</span>
                  <span>৳{dueAmount.toFixed(2)}</span>
                </div>
              )}
              {changeAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: 'var(--color-success)', fontSize: '14px', borderTop: '1px solid #eee', paddingTop: '4px' }}>
                  <span>Change Returned:</span>
                  <span>৳{changeAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1, borderColor: '#ccc', color: '#333' }}
                onClick={() => window.print()}
              >
                <Printer size={16} /> Print
              </button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1 }}
                onClick={handleNewSale}
              >
                New Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
