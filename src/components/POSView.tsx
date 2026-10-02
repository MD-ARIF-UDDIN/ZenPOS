import React, { useState, useEffect, useRef } from 'react';
import { usePOSStore, useNotificationStore } from '../store';
import type { ProductVariant } from '../store';
import { dbService } from '../dbService';
import { Search, Trash2, Plus, Minus, Printer, CheckCircle } from 'lucide-react';
import { InvoicePrintModal, type InvoiceData } from './InvoicePrintModal';

interface POSViewProps {
  onRefreshStats: () => void;
}

export const POSView: React.FC<POSViewProps> = ({ onRefreshStats }) => {
  const { showToast } = useNotificationStore();
  const { 
    cart, 
    discount, 
    paymentMethod, 
    addToCart, 
    removeFromCart, 
    updateCartQty, 
    updateCartPrice,
    clearCart, 
    setDiscount
  } = usePOSStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);
  const [lastCompletedInvoice, setLastCompletedInvoice] = useState<InvoiceData | null>(null);
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

  // Barcode Map lookup and search memoization for instant 0ms scanner response
  const barcodeMap = React.useMemo(() => {
    const map = new Map<string, ProductVariant>();
    variants.forEach(v => {
      if (v.barcode) {
        const raw = v.barcode.trim();
        const unhyphenated = raw.replace(/[\s-]/g, '');
        map.set(raw, v);
        map.set(raw.toLowerCase(), v);
        map.set(unhyphenated, v);
        map.set(unhyphenated.toLowerCase(), v);
      }
      if (v.sku) {
        map.set(v.sku.trim(), v);
        map.set(v.sku.trim().toLowerCase(), v);
      }
    });
    return map;
  }, [variants]);

  const findMatchingVariant = (queryText: string): ProductVariant | undefined => {
    const raw = (queryText || '').trim().replace(/[\r\n\t]/g, '');
    if (!raw) return undefined;
    const clean = raw.replace(/[\s-]/g, '').toLowerCase();

    // 1. Direct Map lookup (O(1))
    const fromMap = barcodeMap.get(raw) || barcodeMap.get(raw.toLowerCase()) || barcodeMap.get(clean);
    if (fromMap) return fromMap;

    // 2. Exact or stripped barcode in variants list
    const match = variants.find(v => {
      if (!v.barcode) return false;
      const bc = v.barcode.trim().toLowerCase();
      const cleanBc = bc.replace(/[\s-]/g, '');
      return bc === raw.toLowerCase() || cleanBc === clean;
    });
    if (match) return match;

    // 3. Exact SKU match
    const skuMatch = variants.find(v => {
      if (!v.sku) return false;
      const sku = v.sku.trim().toLowerCase();
      return sku === raw.toLowerCase() || sku.replace(/[\s-]/g, '') === clean;
    });
    return skuMatch;
  };

  // Fast memoized search results (limit to top 15 results for ultra-fast rendering)
  const searchResults = React.useMemo(() => {
    const qTrim = searchQuery.trim();
    if (!qTrim) return [];
    
    // Check direct barcode first
    const exact = findMatchingVariant(qTrim);
    if (exact) return [exact];

    const q = qTrim.toLowerCase();
    const cleanQ = q.replace(/[\s-]/g, '');
    const matches: ProductVariant[] = [];
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      if (
        (v.sku && (v.sku.toLowerCase().includes(q) || v.sku.toLowerCase().replace(/[\s-]/g, '').includes(cleanQ))) ||
        (v.barcode && (v.barcode.toLowerCase().includes(q) || v.barcode.toLowerCase().replace(/[\s-]/g, '').includes(cleanQ))) ||
        (v.product?.name && v.product.name.toLowerCase().includes(q))
      ) {
        matches.push(v);
        if (matches.length >= 15) break; // Keep UI ultra lightweight
      }
    }
    return matches;
  }, [searchQuery, variants, barcodeMap]);

  // Focus search input automatically on view mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + (item.quantity * (item.customPrice !== undefined ? item.customPrice : item.variant.selling_price)), 0);
  const payableAmount = Math.max(0, subtotal - discount);
  const totalReceived = paymentRows.reduce((acc, r) => acc + (r.amount || 0), 0);
  const changeAmount = totalReceived > payableAmount ? totalReceived - payableAmount : 0;
  const dueAmount = totalReceived < payableAmount ? payableAmount - totalReceived : 0;

  const removePaymentRow = (idx: number) => setPaymentRows(prev => prev.filter((_, i) => i !== idx));
  const updatePaymentRow = (idx: number, field: 'method' | 'amount', value: string | number) =>
    setPaymentRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  const fillRemaining = (idx: number) => {
    const otherTotal = paymentRows.reduce((acc, r, i) => i !== idx ? acc + (r.amount || 0) : acc, 0);
    const remaining = Math.max(0, payableAmount - otherTotal);
    updatePaymentRow(idx, 'amount', remaining);
  };

  const handleNewSale = () => {
    clearCart();
    setCheckoutSuccess(null);
    setShowReceipt(false);
    setSearchQuery('');
    setCustomerPhone('');
    setDiscount(0);
    setPaymentRows([{ method: 'CASH', amount: 0 }]);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const addItemToCart = (variant: ProductVariant) => {
    if (checkoutSuccess || showReceipt) {
      clearCart();
      setCheckoutSuccess(null);
      setShowReceipt(false);
      setCustomerPhone('');
      setDiscount(0);
      setPaymentRows([{ method: 'CASH', amount: 0 }]);
    }
    if (variant.stock_quantity <= 0) {
      showToast(`Warning: ${variant.product?.name} (${variant.color}/${variant.size}) is out of stock!`, 'warning');
    }
    addToCart(variant);
    setSearchQuery('');
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
    }
    setTimeout(() => searchInputRef.current?.focus(), 10);
  };

  const [autoPrint, setAutoPrint] = useState<boolean>(() => {
    return localStorage.getItem('pos_auto_print') === 'true';
  });

  const toggleAutoPrint = (val: boolean) => {
    setAutoPrint(val);
    localStorage.setItem('pos_auto_print', val ? 'true' : 'false');
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

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

      const invoiceData: InvoiceData = {
        invoiceId: saleId,
        saleDate: new Date().toISOString(),
        paymentMethod: paymentMethod,
        customerPhone: customerPhone,
        totalAmount: subtotal,
        discountAmount: discount,
        payableAmount: payableAmount,
        receivedAmount: totalReceived,
        dueAmount: dueAmount,
        changeAmount: changeAmount,
        paymentRows: paymentRows,
        items: cart.map(item => ({
          name: item.variant.product?.name || 'Item',
          size: item.variant.size,
          color: item.variant.color,
          sku: item.variant.sku,
          quantity: item.quantity,
          unitPrice: item.customPrice !== undefined ? item.customPrice : item.variant.selling_price,
          totalPrice: item.quantity * (item.customPrice !== undefined ? item.customPrice : item.variant.selling_price)
        }))
      };

      setLastCompletedInvoice(invoiceData);
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


  // Global scanner listener & POS quick keys (F2 = checkout, Ctrl+F = focus, Esc = new sale)
  useEffect(() => {
    let scanBuffer = '';
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Focus search on Ctrl + F
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Quick Checkout on F2 or Ctrl + Enter
      if (e.key === 'F2' || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        if (cart.length > 0 && !checkingOut) {
          handleCheckout();
        }
        return;
      }

      // Quick Reset on Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showReceipt) {
          handleNewSale();
        }
        return;
      }

      const target = e.target as HTMLElement | null;
      const isOtherInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && target !== searchInputRef.current;
      
      // If the user is actively typing in customer phone or another input, don't hijack unless it's a high-speed scanner
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      // Reset buffer if elapsed time between keys > 100ms (human typing vs hardware scanner)
      if (timeDiff > 100) {
        scanBuffer = '';
      }

      if (e.key === 'Enter') {
        const rawBuffer = scanBuffer.trim();
        const liveInputVal = searchInputRef.current?.value?.trim() || '';
        const candidate = rawBuffer.length >= 4 ? rawBuffer : liveInputVal;
        if (candidate.length >= 2) {
          const match = findMatchingVariant(candidate);
          if (match) {
            e.preventDefault();
            addItemToCart(match);
            scanBuffer = '';
            return;
          }
        }
        scanBuffer = '';
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        scanBuffer += e.key;
        
        // If not focused on search input and not typing in another input, redirect focus
        if (!isOtherInput && document.activeElement !== searchInputRef.current) {
          searchInputRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [barcodeMap, variants, checkoutSuccess, showReceipt, cart, checkingOut, totalReceived, payableAmount, autoPrint, addToCart, clearCart, setDiscount, showToast]);

  // Handle barcode scanner input (which usually acts as keyboard + Enter)
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const currentVal = (searchInputRef.current?.value || searchQuery).trim();
    if (!currentVal) return;

    const exactMatch = findMatchingVariant(currentVal);
    if (exactMatch) {
      addItemToCart(exactMatch);
    } else if (searchResults.length === 1) {
      addItemToCart(searchResults[0]);
    } else if (searchResults.length === 0) {
      showToast(`No product found for "${currentVal}"`, 'warning');
    }
  };

  const handleResultClick = (v: ProductVariant) => {
    addItemToCart(v);
  };


  return (
    <div className="pos-layout">
      {/* LEFT: Cart & Product Scanner */}
      <div className="pos-main">
        {/* Search & Barcode scanning input */}
        <div className="card" style={{ padding: '12px' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', position: 'relative' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                ref={searchInputRef}
                type="text"
                className="form-control"
                placeholder="Scan barcode or type name/SKU... (Ctrl+F)"
                value={searchQuery}
                onInput={(e) => {
                  const val = (e.currentTarget.value || '').trim();
                  if (!val) return;
                  const cleanVal = val.replace(/[^0-9a-zA-Z]/g, '');
                  if (cleanVal.length >= 4) {
                    const match = findMatchingVariant(cleanVal);
                    if (match) {
                      addItemToCart(match);
                    }
                  }
                }}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const currentDomVal = (e.currentTarget.value || searchQuery).trim();
                    if (!currentDomVal) return;
                    const match = findMatchingVariant(currentDomVal);
                    if (match) {
                      addItemToCart(match);
                    } else if (searchResults.length === 1) {
                      addItemToCart(searchResults[0]);
                    } else if (searchResults.length === 0) {
                      showToast(`No product found for "${currentDomVal}"`, 'warning');
                    }
                  }
                }}
                style={{ paddingLeft: '36px', width: '100%', height: '38px', fontSize: '13px' }}
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ height: '38px', padding: '0 16px' }}>Enter</button>

            {/* Quick dropdown for name matching */}
            {searchResults.length > 0 && searchQuery !== searchResults[0].barcode && (
              <div style={{
                position: 'absolute',
                top: '44px',
                left: 0,
                right: 0,
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                zIndex: 100,
                maxHeight: '240px',
                overflowY: 'auto',
                boxShadow: 'var(--shadow-lg)'
              }}>
                {searchResults.map(v => (
                  <div 
                    key={v.id} 
                    onClick={() => handleResultClick(v)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    className="search-item-row"
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{v.product?.name}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                        SKU: {v.sku} | {v.color} / {v.size} | BC: {v.barcode}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '13px' }}>৳{v.selling_price.toFixed(2)}</div>
                      <div style={{ fontSize: '10.5px', color: v.stock_quantity > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Featured Items (Quick Add)
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
            {variants.slice(0, 4).map(v => (
              <div 
                key={v.id}
                onClick={() => handleResultClick(v)}
                className="card"
                style={{
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  textAlign: 'center',
                  background: '#fff',
                  border: '1px solid var(--border-color)',
                  boxShadow: 'var(--shadow-xs)'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                  {v.product?.name}
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', margin: '1px 0 3px 0' }}>
                  {v.size} / {v.color}
                </div>
                <div style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: '13px' }}>
                  ৳{v.selling_price.toFixed(2)}
                </div>
                <span style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  marginTop: '2px',
                  padding: '1px 5px',
                  borderRadius: '8px',
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
                <th style={{ width: '90px' }}>Size/Color</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Price</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Qty</th>
                <th style={{ width: '100px', textAlign: 'right' }}>Total</th>
                <th style={{ width: '45px' }}></th>
              </tr>
            </thead>
            <tbody>
              {cart.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
                    Cart is empty. Scan barcode or search above to add items.
                  </td>
                </tr>
              ) : (
                cart.map(item => (
                  <tr key={item.variant.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{item.variant.product?.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        SKU: {item.variant.sku} | BC: {item.variant.barcode}
                      </div>
                    </td>
                    <td>
                      <span style={{
                        background: 'var(--bg-primary)',
                        padding: '2px 5px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        marginRight: '3px'
                      }}>{item.variant.size}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{item.variant.color}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>৳</span>
                        <input
                          type="number"
                          className="form-control"
                          value={item.customPrice !== undefined ? item.customPrice : item.variant.selling_price}
                          onChange={(e) => updateCartPrice(item.variant.id, Number(e.target.value))}
                          style={{ width: '70px', height: '28px', padding: '2px 4px', fontSize: '12px', textAlign: 'center' }}
                        />
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          style={{ width: '24px', height: '24px', padding: 0 }}
                          onClick={() => updateCartQty(item.variant.id, item.quantity - 1)}
                        >
                          <Minus size={11} />
                        </button>
                        <span style={{ minWidth: '20px', fontWeight: 'bold', fontSize: '13px' }}>{item.quantity}</span>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          style={{ width: '24px', height: '24px', padding: 0 }}
                          onClick={() => {
                            if (item.quantity >= item.variant.stock_quantity) {
                              showToast(`Warning: Only ${item.variant.stock_quantity} units available in stock.`, 'warning');
                            }
                            updateCartQty(item.variant.id, item.quantity + 1);
                          }}
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '13px' }}>
                      ৳{(item.quantity * (item.customPrice !== undefined ? item.customPrice : item.variant.selling_price)).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        className="btn btn-danger btn-sm" 
                        style={{ width: '24px', height: '24px', padding: 0 }}
                        onClick={() => removeFromCart(item.variant.id)}
                        title="Remove from Cart"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cart View (Cards instead of Table) */}
        <div className="mobile-cart-list" style={{ flexDirection: 'column', gap: '8px' }}>
          {cart.length === 0 ? (
            <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
              Cart is empty. Scan products or search to add them.
            </div>
          ) : (
            cart.map(item => (
              <div className="card" key={item.variant.id} style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px' }}>{item.variant.product?.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '1px' }}>
                      SKU: {item.variant.sku} | BC: {item.variant.barcode}
                    </div>
                  </div>
                  <button 
                    className="btn btn-danger btn-sm" 
                    style={{ width: '24px', height: '24px', padding: 0 }}
                    onClick={() => removeFromCart(item.variant.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                  {/* Size & Color */}
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <span style={{ background: 'var(--bg-primary)', padding: '2px 5px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>{item.variant.size}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{item.variant.color}</span>
                  </div>

                  {/* Edit Price input */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Price:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>৳</span>
                      <input
                        type="number"
                        className="form-control"
                        value={item.customPrice !== undefined ? item.customPrice : item.variant.selling_price}
                        onChange={(e) => updateCartPrice(item.variant.id, Number(e.target.value))}
                        style={{ width: '65px', height: '26px', padding: '2px 4px', fontSize: '11.5px', textAlign: 'center' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px' }}>
                  {/* Quantity selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      style={{ width: '22px', height: '22px', padding: 0 }}
                      onClick={() => updateCartQty(item.variant.id, item.quantity - 1)}
                    >
                      <Minus size={10} />
                    </button>
                    <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{item.quantity}</span>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      style={{ width: '22px', height: '22px', padding: 0 }}
                      onClick={() => {
                        if (item.quantity >= item.variant.stock_quantity) {
                          showToast(`Warning: Only ${item.variant.stock_quantity} units available in stock.`, 'warning');
                        }
                        updateCartQty(item.variant.id, item.quantity + 1);
                      }}
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                  
                  {/* Total */}
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-primary)' }}>
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
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)', background: '#ffffff' }}>
          Sale Summary
        </div>
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
          
          {/* Subtotal */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
            <span style={{ fontWeight: 700 }}>৳{subtotal.toFixed(2)}</span>
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

          {/* Discount Section with Quick % Chips */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label className="form-label" style={{ margin: 0 }}>Discount (৳ / %)</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setDiscount(Math.round(subtotal * 0.15))}
                  className="btn btn-secondary btn-sm"
                  style={{
                    padding: '2px 6px',
                    fontSize: '10.5px',
                    fontWeight: 800,
                    backgroundColor: discount === Math.round(subtotal * 0.15) && discount > 0 ? '#ffe4e6' : 'var(--bg-primary)',
                    color: discount === Math.round(subtotal * 0.15) && discount > 0 ? '#e11d48' : 'var(--color-primary)',
                    borderColor: discount === Math.round(subtotal * 0.15) && discount > 0 ? '#fda4af' : 'var(--border-color)',
                  }}
                  title="Apply 15% Opening Discount"
                >
                  🎉 15% Off
                </button>
                <button
                  type="button"
                  onClick={() => setDiscount(Math.round(subtotal * 0.10))}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '2px 6px', fontSize: '10.5px', fontWeight: 700 }}
                >
                  10%
                </button>
                <button
                  type="button"
                  onClick={() => setDiscount(Math.round(subtotal * 0.20))}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '2px 6px', fontSize: '10.5px', fontWeight: 700 }}
                >
                  20%
                </button>
                {discount > 0 && (
                  <button
                    type="button"
                    onClick={() => setDiscount(0)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 6px', fontSize: '10.5px', color: 'var(--color-danger)' }}
                    title="Clear Discount"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 700, fontSize: '12px' }}>৳</span>
              <input 
                type="number" 
                className="form-control" 
                value={discount || ''} 
                onChange={(e) => setDiscount(Number(e.target.value))}
                placeholder="0.00"
                style={{ paddingLeft: '22px' }}
              />
            </div>
            {discount > 0 && subtotal > 0 && (
              <div style={{ fontSize: '11px', color: '#e11d48', fontWeight: 700, marginTop: '3px', textAlign: 'right' }}>
                Applied: {((discount / subtotal) * 100).toFixed(1)}% OFF (-৳{discount.toFixed(2)})
              </div>
            )}
          </div>

          {/* Payable Total Banner */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '10px 14px', 
            background: 'var(--color-primary-light)', 
            border: '1px solid rgba(11, 37, 69, 0.1)',
            borderRadius: 'var(--radius-sm)' 
          }}>
            <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-primary)' }}>Total Payable:</span>
            <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--color-primary)' }}>
              ৳{payableAmount.toFixed(2)}
            </span>
          </div>

          {/* Payment Section */}
          <div className="form-group">
            <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>Payment Method</label>

            {/* Method pill toggles */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
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
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: isActive ? `1.5px solid ${opt.bg}` : '1px solid var(--border-color)',
                      background: isActive ? opt.bg : opt.light,
                      color: isActive ? opt.text : opt.bg,
                      transition: 'all 0.12s',
                    }}
                  >
                    <span>{opt.icon}</span>
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Amount inputs for active methods */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                  <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{
                      width: '50px', flexShrink: 0, fontSize: '11.5px', fontWeight: 700,
                      color: m.color, textAlign: 'right'
                    }}>{m.label}</span>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--text-muted)', fontSize: '12px' }}>৳</span>
                      <input
                        type="number"
                        className="form-control"
                        value={row.amount || ''}
                        onChange={e => updatePaymentRow(idx, 'amount', Number(e.target.value))}
                        placeholder="0.00"
                        style={{ paddingLeft: '22px', fontSize: '13px', fontWeight: 700, height: '32px', borderColor: m.color + '60' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => fillRemaining(idx)}
                      title="Fill remaining"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0 8px', height: '32px', fontSize: '11px', fontWeight: 700, color: m.color, flexShrink: 0 }}
                    >
                      Fill
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary row */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 10px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Total Received</span>
              <span style={{ fontWeight: 700 }}>৳{totalReceived.toFixed(2)}</span>
            </div>
            {changeAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Change to Return</span>
                <span style={{ color: 'var(--color-success)', fontWeight: 700, fontSize: '13px' }}>৳{changeAmount.toFixed(2)}</span>
              </div>
            )}
            {dueAmount > 0 && totalReceived > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>Customer Due</span>
                <span style={{ color: 'var(--color-danger)', fontWeight: 700, fontSize: '13px' }}>৳{dueAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Auto Print Setting & Quick Key Reminder */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: 'var(--text-secondary)', padding: '2px 4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={autoPrint}
                onChange={e => toggleAutoPrint(e.target.checked)}
                style={{ width: '14px', height: '14px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
              />
              <span>⚡ Auto-Print Receipt</span>
            </label>
            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 700 }}>
              [F2 / Ctrl+Enter]
            </span>
          </div>

          {/* Checkout Button */}
          <button
            onClick={handleCheckout}
            className="btn btn-primary"
            style={{ width: '100%', padding: '10px 14px', height: '42px', borderRadius: 'var(--radius-sm)', fontSize: '14px', fontWeight: 800, marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            disabled={cart.length === 0 || checkingOut}
          >
            <Printer size={16} />
            {checkingOut ? 'Checking out...' : 'Complete & Checkout (F2)'}
          </button>
        </div>
      </div>

      {/* 58mm THERMAL RECEIPT MODAL */}
      {showReceipt && lastCompletedInvoice && (
        <InvoicePrintModal
          data={lastCompletedInvoice}
          onClose={() => {
            setShowReceipt(false);
            handleNewSale();
          }}
          onNewSale={() => {
            setShowReceipt(false);
            handleNewSale();
          }}
        />
      )}
    </div>
  );
};

