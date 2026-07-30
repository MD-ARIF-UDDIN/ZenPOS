import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import type { ProductVariant } from '../store';
import { useNotificationStore } from '../store';
import { Plus, Search, Tag, Truck, Check, FileText } from 'lucide-react';

interface PurchasesViewProps {
  onRefreshStats: () => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({ onRefreshStats }) => {
  const { showToast } = useNotificationStore();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  
  // Create Purchase workflow states
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [shippingCost, setShippingCost] = useState(0);
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [purchaseItems, setPurchaseItems] = useState<{ variantId: string; quantity: number; unitCost: number; name: string }[]>([]);
  
  // Scanner lookup inside purchase modal
  const [scanQuery, setScanQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Create Supplier modal states
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');

  const loadData = async () => {
    const purchList = await dbService.getPurchases();
    const supList = await dbService.getSuppliers();
    const varList = await dbService.getVariants();
    setPurchases(purchList);
    setSuppliers(supList);
    setVariants(varList);
    if (supList.length > 0) setSelectedSupplierId(supList[0].id);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) return;
    const sup = await dbService.saveSupplier({ name: supName, contact_person: supContact, phone: supPhone });
    setSuppliers(prev => [...prev, sup]);
    setSelectedSupplierId(sup.id);
    setShowSupplierModal(false);
    setSupName('');
    setSupContact('');
    setSupPhone('');
  };

  const handleScanOrSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanQuery.trim()) return;

    // Search exact barcode
    const match = variants.find(v => v.barcode === scanQuery);
    if (match) {
      addItemToPurchase(match);
      setScanQuery('');
    } else {
      // search SKU or Product Name partially
      const partial = variants.filter(v => 
        v.sku.toLowerCase().includes(scanQuery.toLowerCase()) || 
        v.product?.name.toLowerCase().includes(scanQuery.toLowerCase())
      );
      if (partial.length === 1) {
        addItemToPurchase(partial[0]);
        setScanQuery('');
      } else if (partial.length > 1) {
        showToast(`Multiple products matched (${partial.length}). Please scan exact barcode or enter unique SKU.`, 'warning');
      } else {
        showToast('No matching product found.', 'warning');
      }
    }
  };

  const filteredSuggestions = variants.filter(v =>
    scanQuery.trim() === '' ||
    v.barcode?.toLowerCase().includes(scanQuery.toLowerCase()) ||
    v.sku?.toLowerCase().includes(scanQuery.toLowerCase()) ||
    v.product?.name?.toLowerCase().includes(scanQuery.toLowerCase()) ||
    v.color?.toLowerCase().includes(scanQuery.toLowerCase()) ||
    v.size?.toLowerCase().includes(scanQuery.toLowerCase())
  );

  const addItemToPurchase = (v: ProductVariant) => {
    const existingIndex = purchaseItems.findIndex(item => item.variantId === v.id);
    if (existingIndex > -1) {
      const updated = [...purchaseItems];
      updated[existingIndex].quantity += 1;
      setPurchaseItems(updated);
    } else {
      setPurchaseItems([...purchaseItems, {
        variantId: v.id,
        quantity: 1,
        unitCost: v.purchase_price,
        name: `${v.product?.name} (${v.size}/${v.color})`
      }]);
    }
  };

  const updateItemQty = (index: number, val: number) => {
    const updated = [...purchaseItems];
    updated[index].quantity = Math.max(1, val);
    setPurchaseItems(updated);
  };

  const updateItemCost = (index: number, val: number) => {
    const updated = [...purchaseItems];
    updated[index].unitCost = Math.max(0, val);
    setPurchaseItems(updated);
  };

  const removeItem = (index: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  const handleSubmitPurchase = async () => {
    if (!selectedSupplierId || !invoiceNumber.trim() || purchaseItems.length === 0) {
      showToast('Please fill in supplier, invoice number, and add at least one product.', 'warning');
      return;
    }

    try {
      setSavingPurchase(true);
      showToast('Logging supplier purchase...', 'info');
      await dbService.addPurchase(selectedSupplierId, purchaseItems, invoiceNumber, shippingCost);
      setShowAddModal(false);
      setInvoiceNumber('');
      setShippingCost(0);
      setPurchaseItems([]);
      await loadData();
      onRefreshStats();
      showToast('Purchase stock logged successfully!', 'success');
    } catch (err) {
      showToast('Error logging purchase', 'error');
    } finally {
      setSavingPurchase(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Self-contained CSS for Purchases Responsiveness */}
      <style>{`
        .purchase-form-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        @media (max-width: 768px) {
          .purchase-modal-card {
            width: 95% !important;
            padding: 18px !important;
            max-height: 95vh !important;
          }
          .purchase-form-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
        }
      `}</style>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={18} /> Create Purchase
        </button>
      </div>

      {/* History table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>Sl.</th>
              <th>Purchase Date</th>
              <th>Supplier</th>
              <th>Invoice #</th>
              <th>Shipping Cost</th>
              <th>Total Cost</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  No purchase history available. Restock items to log supplier data.
                </td>
              </tr>
            ) : (
              purchases.map((p, idx) => (
                <tr key={p.id}>
                  <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}</td>
                  <td>{new Date(p.purchase_date).toLocaleDateString()}</td>
                  <td>{p.supplier?.name || 'Unknown Supplier'}</td>
                  <td style={{ fontWeight: 'bold' }}>{p.invoice_number}</td>
                  <td>৳{(p.shipping_cost || 0).toFixed(2)}</td>
                  <td>৳{p.total_amount.toFixed(2)}</td>
                  <td>
                    <span style={{
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: 'var(--color-success)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 600
                    }}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* LOG PURCHASE ORDER MODAL */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 500 }}>
          <div className="card purchase-modal-card" style={{ width: '90%', maxWidth: '700px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto' }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              paddingBottom: '16px',
              borderBottom: '1px solid var(--border-color)',
              marginBottom: '4px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  background: 'rgba(13, 148, 136, 0.1)',
                  color: 'var(--color-primary)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Truck size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Log Supplier Purchase
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Add restock items, set quantities and cost prices, then confirm receipt
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '20px', lineHeight: 1, padding: '4px' }}
              >
                ✕
              </button>
            </div>
            <div className="purchase-form-grid">
              
              <div className="form-group">
                <label className="form-label">Supplier</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select 
                    className="form-control" 
                    value={selectedSupplierId} 
                    onChange={e => setSelectedSupplierId(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={() => setShowSupplierModal(true)}>
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Invoice / Bill Number *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={invoiceNumber} 
                  onChange={e => setInvoiceNumber(e.target.value)} 
                  placeholder="e.g. INV-1002"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Shipping Cost (৳)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={shippingCost || ''} 
                  onChange={e => setShippingCost(Math.max(0, Number(e.target.value)))} 
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Scanning tool */}
            <div className="form-group">
              <label className="form-label">Search Product to Restock</label>
              <input 
                type="text" 
                className="form-control" 
                value={scanQuery} 
                onChange={e => { setScanQuery(e.target.value); setShowSuggestions(true); }} 
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
                placeholder="Click or type to search products..." 
                autoComplete="off"
              />
              {showSuggestions && (
                <div style={{
                  marginTop: '6px',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'white',
                  maxHeight: '200px',
                  overflowY: 'auto',
                }}>
                  {filteredSuggestions.length === 0 ? (
                    <div style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>No products found</div>
                  ) : (
                    filteredSuggestions.map(v => (
                      <div
                        key={v.id}
                        onMouseDown={() => {
                          addItemToPurchase(v);
                          setScanQuery('');
                          setShowSuggestions(false);
                        }}
                        style={{
                          padding: '10px 16px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border-color)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-primary)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {v.product?.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {v.size} · {v.color} · SKU: {v.sku}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '12px', flexShrink: 0, marginLeft: '12px' }}>
                          <div style={{ color: 'var(--color-primary)', fontWeight: 600 }}>৳{v.purchase_price}</div>
                          <div style={{ color: 'var(--text-muted)' }}>{v.barcode}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Added list */}
            <div>
              <h5 style={{ marginBottom: '8px', fontSize: '14px' }}>Items to Restock</h5>
              <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product / Size / Color</th>
                      <th style={{ width: '120px' }}>Quantity</th>
                      <th style={{ width: '120px' }}>Cost Price (৳)</th>
                      <th style={{ width: '60px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                          No restock items added. Scan a barcode above to add items.
                        </td>
                      </tr>
                    ) : (
                      purchaseItems.map((item, idx) => (
                        <tr key={item.variantId}>
                          <td style={{ fontWeight: 600 }}>{item.name}</td>
                          <td>
                            <input 
                              type="number" 
                              className="form-control" 
                              value={item.quantity} 
                              onChange={e => updateItemQty(idx, Number(e.target.value))}
                              style={{ width: '80px', padding: '6px' }}
                            />
                          </td>
                          <td>
                            <input 
                              type="number" 
                              step="0.01"
                              className="form-control" 
                              value={item.unitCost} 
                              onChange={e => updateItemCost(idx, Number(e.target.value))}
                              style={{ width: '100px', padding: '6px' }}
                            />
                          </td>
                          <td>
                            <button className="btn btn-danger" style={{ padding: '6px' }} onClick={() => removeItem(idx)}>
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '8px' }}>
              <div>
                Total Bill Value:{' '}
                <span style={{ fontWeight: 'bold', fontSize: '18px', color: 'var(--color-primary)' }}>
                  ৳{(purchaseItems.reduce((acc, i) => acc + (i.quantity * i.unitCost), 0) + shippingCost).toFixed(2)}
                </span>
                {shippingCost > 0 && (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                    (Includes ৳{shippingCost.toFixed(2)} shipping)
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSubmitPurchase} disabled={purchaseItems.length === 0 || savingPurchase}>
                  {savingPurchase ? 'Receiving...' : 'Receive Stock'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK ADD SUPPLIER MODAL */}
      {showSupplierModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 600 }}>
          <div className="card" style={{ width: '400px' }}>
            <h3 style={{ marginBottom: '16px' }}>Add Supplier</h3>
            <form onSubmit={handleCreateSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Supplier Name *</label>
                <input type="text" className="form-control" value={supName} onChange={e => setSupName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Person</label>
                <input type="text" className="form-control" value={supContact} onChange={e => setSupContact(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input type="text" className="form-control" value={supPhone} onChange={e => setSupPhone(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSupplierModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
