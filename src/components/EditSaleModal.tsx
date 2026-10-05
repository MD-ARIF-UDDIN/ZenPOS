import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import { useNotificationStore } from '../store';
import type { ProductVariant } from '../store';
import { X, Trash2, Plus, Minus, Search, AlertTriangle, Save } from 'lucide-react';

interface EditSaleModalProps {
  sale: any;
  initialItems: any[];
  onClose: () => void;
  onSuccess: () => void;
}

interface EditableSaleItem {
  id?: string; // existing sale_item id if from original sale
  variant_id: string;
  name: string;
  size?: string;
  color?: string;
  sku?: string;
  barcode?: string;
  quantity: number;
  originalQuantity: number;
  unit_price: number;
  current_stock: number;
  sale_type?: 'SALE' | 'RENT';
  return_date?: string | null;
}

export const EditSaleModal: React.FC<EditSaleModalProps> = ({
  sale,
  initialItems,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useNotificationStore();
  const [items, setItems] = useState<EditableSaleItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(sale.discount_amount || 0);
  const [paymentMethod, setPaymentMethod] = useState<string>(sale.payment_method || 'CASH');
  const [receivedAmount, setReceivedAmount] = useState<number>(sale.received_amount ?? sale.payable_amount);
  const [customerPhone, setCustomerPhone] = useState<string>(sale.customer_phone || '');
  const [saving, setSaving] = useState(false);

  // Variant search state
  const [variantsList, setVariantsList] = useState<ProductVariant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductVariant[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  useEffect(() => {
    // Load variants to know current stock & enable adding items
    const loadVariantsAndInit = async () => {
      try {
        const variants = await dbService.getVariants();
        setVariantsList(variants);

        const variantMap = new Map(variants.map((v) => [v.id, v]));

        const formattedItems: EditableSaleItem[] = initialItems.map((it) => {
          const v = variantMap.get(it.variant_id) || it.variant;
          return {
            id: it.id,
            variant_id: it.variant_id,
            name: v?.product?.name || it.variant?.product?.name || 'Product',
            size: v?.size || it.variant?.size,
            color: v?.color || it.variant?.color,
            sku: v?.sku || it.variant?.sku,
            barcode: v?.barcode || it.variant?.barcode,
            quantity: it.quantity,
            originalQuantity: it.quantity,
            unit_price: it.unit_price || (it.total_price / (it.quantity || 1)),
            current_stock: v ? v.stock_quantity : 0,
            sale_type: it.sale_type || 'SALE',
            return_date: it.return_date || null,
          };
        });

        setItems(formattedItems);
      } catch (e) {
        console.error('Error loading variants for sale edit', e);
      }
    };

    loadVariantsAndInit();
  }, [sale, initialItems]);

  // Handle Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    const q = searchQuery.toLowerCase().trim();
    const matches = variantsList.filter((v) => {
      const pName = v.product?.name?.toLowerCase() || '';
      const sku = v.sku?.toLowerCase() || '';
      const barcode = v.barcode?.toLowerCase() || '';
      return pName.includes(q) || sku.includes(q) || barcode.includes(q);
    });
    setSearchResults(matches.slice(0, 8));
    setShowSearchResults(true);
  }, [searchQuery, variantsList]);

  const handleAddItem = (variant: ProductVariant) => {
    // Check if already in items
    const existingIndex = items.findIndex((it) => it.variant_id === variant.id);
    if (existingIndex >= 0) {
      // Increase quantity
      handleQuantityChange(existingIndex, items[existingIndex].quantity + 1);
    } else {
      const isRentProduct = variant.product?.category?.toLowerCase().trim() === 'sherwani' || Boolean(variant.rent_price);
      const defaultReturnDate = () => {
        const d = new Date();
        d.setDate(d.getDate() + 3);
        return d.toISOString().split('T')[0];
      };

      const newItem: EditableSaleItem = {
        variant_id: variant.id,
        name: variant.product?.name || 'Product',
        size: variant.size,
        color: variant.color,
        sku: variant.sku,
        barcode: variant.barcode,
        quantity: 1,
        originalQuantity: 0,
        unit_price: variant.selling_price || 0,
        current_stock: variant.stock_quantity,
        sale_type: 'SALE',
        return_date: isRentProduct ? defaultReturnDate() : null,
      };
      setItems([...items, newItem]);
    }
    setSearchQuery('');
    setShowSearchResults(false);
  };

  const handleQuantityChange = (index: number, newQty: number) => {
    if (newQty < 1) return;
    const it = items[index];
    // Maximum allowable quantity = current_stock + originalQuantity (already allocated)
    const maxAvailable = it.current_stock + it.originalQuantity;
    if (newQty > maxAvailable) {
      showToast(`Only ${maxAvailable} units available in stock for ${it.name}!`, 'warning');
      return;
    }

    const updated = [...items];
    updated[index] = { ...it, quantity: newQty };
    setItems(updated);
  };

  const handlePriceChange = (index: number, price: number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], unit_price: Math.max(0, price) };
    setItems(updated);
  };

  const handleTypeChange = (index: number, type: 'SALE' | 'RENT') => {
    const updated = [...items];
    const it = updated[index];
    const defaultReturnDate = () => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      return d.toISOString().split('T')[0];
    };
    updated[index] = {
      ...it,
      sale_type: type,
      return_date: type === 'RENT' ? (it.return_date || defaultReturnDate()) : null
    };
    setItems(updated);
  };

  const handleReturnDateChange = (index: number, returnDate: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], return_date: returnDate };
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      showToast('A sale must have at least 1 item. If you wish to cancel the sale completely, use the Delete button.', 'warning');
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = items.reduce((acc, it) => acc + (it.quantity * it.unit_price), 0);
  const payable = Math.max(0, subtotal - (Number(discountAmount) || 0));
  const due = paymentMethod === 'DUE' ? payable : Math.max(0, payable - (Number(receivedAmount) || 0));
  const change = receivedAmount > payable ? receivedAmount - payable : 0;

  const handleSave = async () => {
    if (items.length === 0) {
      showToast('Sale must contain at least 1 item.', 'error');
      return;
    }

    // Validate quantities
    for (const it of items) {
      if (it.quantity <= 0) {
        showToast(`Quantity for "${it.name}" must be greater than 0`, 'error');
        return;
      }
      const maxAvailable = it.current_stock + it.originalQuantity;
      if (it.quantity > maxAvailable) {
        showToast(`Cannot sell ${it.quantity} units of ${it.name}. Only ${maxAvailable} available!`, 'error');
        return;
      }
    }

    try {
      setSaving(true);
      await dbService.updateSale(
        sale.id,
        {
          discount_amount: Number(discountAmount) || 0,
          payment_method: paymentMethod,
          received_amount: Number(receivedAmount) || 0,
          customer_phone: customerPhone.trim(),
        },
        items.map((it) => ({
          id: it.id,
          variant_id: it.variant_id,
          quantity: it.quantity,
          unit_price: it.unit_price,
          total_price: it.quantity * it.unit_price,
          sale_type: it.sale_type || 'SALE',
          return_date: it.sale_type === 'RENT' ? (it.return_date || null) : null,
        }))
      );

      showToast('Invoice updated successfully! Stock adjusted.', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to update sale', err);
      showToast(err.message || 'Failed to update sale invoice', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(11, 37, 69, 0.45)',
        backdropFilter: 'blur(4px)',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '780px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)' }}>
                Edit Sale Invoice
              </h3>
              <span
                style={{
                  fontFamily: 'monospace',
                  background: 'var(--color-primary)',
                  color: '#fff',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                #{sale.id.toUpperCase().substring(0, 8)}
              </span>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '3px' }}>
              Original Date: {new Date(sale.sale_date).toLocaleString()} • Stock quantities will auto-recalculate
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            disabled={saving}
            style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          
          {/* Customer & Payment Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Customer Phone
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 01700000000"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                style={{ height: '34px', fontSize: '12.5px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Payment Method
              </label>
              <select
                className="form-control"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{ height: '34px', fontSize: '12.5px' }}
              >
                <option value="CASH">CASH</option>
                <option value="CARD">CARD / POS</option>
                <option value="MOBILE_PAY">bKash / Nagad / Rocket</option>
                <option value="DUE">DUE</option>
                <option value="SPLIT">SPLIT PAYMENT</option>
              </select>
            </div>
          </div>

          {/* Add Product Search Bar */}
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
              Add Additional Item to Invoice
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search product by name, barcode, or SKU to add..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '32px', height: '34px', fontSize: '12.5px' }}
              />
            </div>

            {/* Autocomplete Dropdown */}
            {showSearchResults && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-md)',
                  zIndex: 20,
                  marginTop: '4px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                }}
              >
                {searchResults.length === 0 ? (
                  <div style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    No matching products found.
                  </div>
                ) : (
                  searchResults.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => handleAddItem(v)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '1px solid var(--border-color)',
                        fontSize: '12px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-primary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                    >
                      <div>
                        <span style={{ fontWeight: 600 }}>{v.product?.name}</span>
                        {(v.size || v.color) && (
                          <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
                            ({[v.size, v.color].filter(Boolean).join('/')})
                          </span>
                        )}
                        <span style={{ marginLeft: '8px', fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          {v.sku || v.barcode}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: v.stock_quantity > 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>
                          Stock: {v.stock_quantity}
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                          ৳{v.selling_price.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Items Table */}
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
              Invoice Items ({items.length})
            </label>
            <div className="table-container" style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-primary)' }}>
                    <th>Product & Variant</th>
                    <th style={{ width: '90px', textAlign: 'center' }}>Stock Left</th>
                    <th style={{ width: '130px', textAlign: 'center' }}>Quantity</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Unit Price (৳)</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Total (৳)</th>
                    <th style={{ width: '45px', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const maxAvail = it.current_stock + it.originalQuantity;
                    const diff = it.quantity - it.originalQuantity;
                    return (
                      <tr key={it.id || it.variant_id + idx}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 600, fontSize: '12.5px' }}>{it.name}</span>
                            <select
                              value={it.sale_type || 'SALE'}
                              onChange={(e) => handleTypeChange(idx, e.target.value as 'SALE' | 'RENT')}
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 800,
                                padding: '1px 4px',
                                borderRadius: '3px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: it.sale_type === 'RENT' ? '#f5f3ff' : '#f0f4f9',
                                color: it.sale_type === 'RENT' ? '#7c3aed' : 'var(--color-primary)',
                              }}
                            >
                              <option value="SALE">SALE</option>
                              <option value="RENT">RENT</option>
                            </select>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {[it.size, it.color].filter(Boolean).join(' / ')} {it.barcode ? `• ${it.barcode}` : ''}
                          </div>
                          {it.sale_type === 'RENT' && (
                            <div style={{ marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '10.5px', color: '#7c3aed', fontWeight: 600 }}>Return:</span>
                              <input
                                type="date"
                                value={it.return_date || ''}
                                onChange={(e) => handleReturnDateChange(idx, e.target.value)}
                                style={{ height: '22px', fontSize: '10.5px', padding: '1px 3px' }}
                              />
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '11.5px' }}>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: it.current_stock <= 2 ? '#fee2e2' : '#f0fdf4',
                              color: it.current_stock <= 2 ? 'var(--color-danger)' : 'var(--color-success)',
                            }}
                          >
                            {it.current_stock} pcs
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ width: '26px', height: '26px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onClick={() => handleQuantityChange(idx, it.quantity - 1)}
                              disabled={it.quantity <= 1}
                            >
                              <Minus size={12} />
                            </button>
                            <input
                              type="number"
                              min="1"
                              max={maxAvail}
                              className="form-control"
                              value={it.quantity}
                              onChange={(e) => handleQuantityChange(idx, parseInt(e.target.value) || 1)}
                              style={{ width: '46px', height: '26px', textAlign: 'center', padding: '0 2px', fontSize: '12px', fontWeight: 600 }}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ width: '26px', height: '26px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onClick={() => handleQuantityChange(idx, it.quantity + 1)}
                              disabled={it.quantity >= maxAvail}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                          {diff !== 0 && (
                            <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '2px', color: diff > 0 ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 600 }}>
                              {diff > 0 ? `+${diff} sold (stock -${diff})` : `${diff} returned (stock +${Math.abs(diff)})`}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-control"
                            value={it.unit_price}
                            onChange={(e) => handlePriceChange(idx, parseFloat(e.target.value) || 0)}
                            style={{ width: '80px', height: '26px', textAlign: 'right', padding: '0 4px', fontSize: '12px', display: 'inline-block' }}
                          />
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '12.5px' }}>
                          ৳{(it.quantity * it.unit_price).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => handleRemoveItem(idx)}
                            style={{ color: 'var(--color-danger)', padding: '2px 4px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                            title="Remove item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financials & Summary */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              padding: '12px 16px',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Subtotal</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                ৳{subtotal.toFixed(2)}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                Discount (৳)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-control"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                style={{ height: '28px', fontSize: '12.5px', fontWeight: 600, width: '110px' }}
              />
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Payable</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-primary)' }}>
                ৳{payable.toFixed(2)}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                Paid Amount (৳)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-control"
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                style={{ height: '28px', fontSize: '12.5px', fontWeight: 600, width: '110px' }}
              />
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{due > 0 ? 'Due Amount' : 'Change Return'}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: due > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                ৳{due > 0 ? due.toFixed(2) : change.toFixed(2)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <AlertTriangle size={13} style={{ color: 'var(--color-warning)' }} />
            Saving will adjust product stock quantities and update stock ledger entries automatically.
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving} style={{ padding: '6px 14px' }}>
            Cancel
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={saving || items.length === 0}
            style={{ padding: '6px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
