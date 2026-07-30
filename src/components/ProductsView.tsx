import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import type { Product, ProductVariant } from '../store';
import { useNotificationStore } from '../store';
import { Plus, Edit2, Trash2, Tag, Shirt, Filter } from 'lucide-react';

interface ProductsViewProps {
  onRefreshStats: () => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({ onRefreshStats }) => {
  const { showToast, showConfirm } = useNotificationStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  // Forms states
  const [showProductModal, setShowProductModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [newProductBrand, setNewProductBrand] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  const [showVariantModal, setShowVariantModal] = useState(false);
  const [varSku, setVarSku] = useState('');
  const [varBarcode, setVarBarcode] = useState('');
  const [varSize, setVarSize] = useState('');
  const [varColor, setVarColor] = useState('');
  const [varPurchasePrice, setVarPurchasePrice] = useState(0);
  const [varSellingPrice, setVarSellingPrice] = useState(0);
  const [varMinStock, setVarMinStock] = useState(5);
  const [savingVariant, setSavingVariant] = useState(false);
  const [deletingVariantId, setDeletingVariantId] = useState<string | null>(null);

  const loadData = async () => {
    const prodList = await dbService.getProducts();
    const varList = await dbService.getVariants();
    setProducts(prodList);
    setVariants(varList);
    if (prodList.length > 0 && !activeProduct) {
      setActiveProduct(prodList[0]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) return;

    try {
      setSavingProduct(true);
      showToast('Creating product...', 'info');
      const prod = await dbService.saveProduct({
        name: newProductName,
        category: newProductCategory,
        brand: newProductBrand,
        description: newProductDesc
      });
      setShowProductModal(false);
      // Reset fields
      setNewProductName('');
      setNewProductCategory('');
      setNewProductBrand('');
      setNewProductDesc('');
      await loadData();
      setActiveProduct(prod);
      showToast('Product created successfully!', 'success');
    } catch (err) {
      showToast('Error creating product', 'error');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleCreateVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProduct) return;
    if (!varBarcode.trim()) return;

    try {
      setSavingVariant(true);
      // Check if barcode already exists
      const exists = variants.find(v => v.barcode === varBarcode);
      if (exists) {
        showToast('Barcode already exists! Barcode must be unique.', 'warning');
        return;
      }

      showToast('Creating variant...', 'info');
      await dbService.saveVariant({
        product_id: activeProduct.id,
        sku: varSku || `${activeProduct.name.substring(0,3).toUpperCase()}-${varColor.substring(0,3).toUpperCase()}-${varSize}`,
        barcode: varBarcode,
        size: varSize,
        color: varColor,
        purchase_price: varPurchasePrice,
        selling_price: varSellingPrice,
        stock_quantity: 0,
        min_stock_level: varMinStock
      });
      setShowVariantModal(false);
      // Reset fields
      setVarSku('');
      setVarBarcode('');
      setVarSize('');
      setVarColor('');
      setVarPurchasePrice(0);
      setVarSellingPrice(0);
      await loadData();
      onRefreshStats();
      showToast('Variant added successfully!', 'success');
    } catch (err) {
      showToast('Error creating variant', 'error');
    } finally {
      setSavingVariant(false);
    }
  };

  const handleDeleteVariant = (id: string) => {
    showConfirm(
      'Delete Variant',
      'Are you sure you want to delete this variant? This will permanently remove it and clear its stock history.',
      async () => {
        try {
          setDeletingVariantId(id);
          showToast('Deleting variant...', 'info');
          await dbService.deleteVariant(id);
          await loadData();
          onRefreshStats();
          showToast('Variant deleted successfully.', 'success');
        } catch (err) {
          showToast('Error deleting variant', 'error');
        } finally {
          setDeletingVariantId(null);
        }
      }
    );
  };

  const handleDeleteProduct = (id: string) => {
    showConfirm(
      'Delete Product & Variants',
      'Are you sure you want to delete this product and all its variants? This will remove all items and associated stock logs.',
      async () => {
        try {
          setDeletingProductId(id);
          showToast('Deleting product...', 'info');
          await dbService.deleteProduct(id);
          setActiveProduct(null);
          await loadData();
          onRefreshStats();
          showToast('Product and variants deleted.', 'success');
        } catch (err) {
          showToast('Error deleting product', 'error');
        } finally {
          setDeletingProductId(null);
        }
      }
    );
  };

  // Filter variants for selected product
  const activeVariants = variants.filter(v => v.product_id === activeProduct?.id);

  return (
    <div className="products-layout" style={{ alignItems: 'start' }}>
      
      {/* Product List */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Products</h3>
          <button className="btn btn-primary" style={{ padding: '6px 12px' }} onClick={() => setShowProductModal(true)}>
            <Plus size={16} /> Add
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {products.map(p => (
            <div
              key={p.id}
              onClick={() => setActiveProduct(p)}
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: activeProduct?.id === p.id ? 'var(--bg-surface-hover)' : 'transparent',
                border: activeProduct?.id === p.id ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.category}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {p.brand} | {variants.filter(v => v.product_id === p.id).length} Variants
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Product Variants Panel */}
      <div className="card" style={{ maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
        {activeProduct ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0 }}>{activeProduct.name}</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Category: <span style={{ color: 'var(--text-primary)' }}>{activeProduct.category || 'N/A'}</span> | 
                  Brand: <span style={{ color: 'var(--text-primary)' }}>{activeProduct.brand || 'N/A'}</span>
                </p>
                {activeProduct.description && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>{activeProduct.description}</p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowVariantModal(true)}
                  style={{ border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}
                >
                  <Plus size={16} /> Add Variant
                </button>
                <button className="btn btn-danger" style={{ padding: '8px' }} onClick={() => handleDeleteProduct(activeProduct.id)} disabled={deletingProductId === activeProduct.id}>
                   {deletingProductId === activeProduct.id ? 'Deleting...' : <Trash2 size={16} />}
                </button>
              </div>
            </div>

            <div>
              <h4 style={{ marginBottom: '12px', fontSize: '15px' }}>Sizes, Colors & Barcodes</h4>
              
              {/* Desktop Table View */}
              <div className="desktop-cart-table table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>Sl.</th>
                      <th>SKU</th>
                      <th>Barcode</th>
                      <th>Size</th>
                      <th>Color</th>
                      <th>Cost</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th style={{ width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeVariants.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                          No variants defined yet. Add a size/color variant to start tracking stock & barcodes.
                        </td>
                      </tr>
                    ) : (
                      activeVariants.map((v, idx) => (
                        <tr key={v.id}>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}</td>
                          <td style={{ fontWeight: 'bold' }}>{v.sku}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Tag size={12} style={{ color: 'var(--color-primary)' }} />
                              <span>{v.barcode}</span>
                            </div>
                          </td>
                          <td>{v.size}</td>
                          <td>{v.color}</td>
                          <td>৳{v.purchase_price.toFixed(2)}</td>
                          <td>৳{v.selling_price.toFixed(2)}</td>
                          <td style={{ fontWeight: 600, color: v.stock_quantity <= v.min_stock_level ? 'var(--color-danger)' : 'var(--color-success)' }}>
                            {v.stock_quantity}
                          </td>
                          <td>
                             <button className="btn btn-danger" style={{ padding: '6px' }} onClick={() => handleDeleteVariant(v.id)} disabled={deletingVariantId === v.id}>
                               {deletingVariantId === v.id ? '...' : <Trash2 size={12} />}
                             </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="mobile-cart-list" style={{ flexDirection: 'column', gap: '12px' }}>
                {activeVariants.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    No variants defined yet. Add a size/color variant to start tracking stock.
                  </div>
                ) : (
                  activeVariants.map(v => (
                    <div className="card" key={v.id} style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#fff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', boxShadow: 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-primary)' }}>{v.sku}</span>
                         <button className="btn btn-danger" style={{ padding: '4px 6px', borderRadius: '4px' }} onClick={() => handleDeleteVariant(v.id)} disabled={deletingVariantId === v.id}>
                           {deletingVariantId === v.id ? '...' : <Trash2 size={12} />}
                         </button>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <span>BC: <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{v.barcode}</span></span>
                        <span>Size/Color: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{v.size} / {v.color}</span></span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', fontSize: '12px' }}>
                        <div>Cost: <span style={{ fontWeight: 700 }}>৳{v.purchase_price.toFixed(2)}</span></div>
                        <div>Price: <span style={{ fontWeight: 700 }}>৳{v.selling_price.toFixed(2)}</span></div>
                        <span style={{
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          backgroundColor: v.stock_quantity <= v.min_stock_level ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: v.stock_quantity <= v.min_stock_level ? 'var(--color-danger)' : 'var(--color-success)'
                        }}>
                          Stock: {v.stock_quantity}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
            No Product Selected. Create a product from the sidebar to begin.
          </div>
        )}
      </div>

      {/* CREATE PRODUCT MODAL */}
      {showProductModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 500 }}>
          <div className="card" style={{ width: '90%', maxWidth: '450px' }}>
            <h3 style={{ marginBottom: '16px' }}>Add New Clothing Product</h3>
            <form onSubmit={handleCreateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Product Name *</label>
                <input type="text" className="form-control" value={newProductName} onChange={e => setNewProductName(e.target.value)} required placeholder="e.g. Slim Denim Jeans" />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <input type="text" className="form-control" value={newProductCategory} onChange={e => setNewProductCategory(e.target.value)} placeholder="e.g. Pants" />
              </div>
              <div className="form-group">
                <label className="form-label">Brand</label>
                <input type="text" className="form-control" value={newProductBrand} onChange={e => setNewProductBrand(e.target.value)} placeholder="e.g. Levi's" />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-control" value={newProductDesc} onChange={e => setNewProductDesc(e.target.value)} placeholder="Product description..." rows={3} />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowProductModal(false)}>Cancel</button>
                 <button type="submit" className="btn btn-primary" disabled={savingProduct}>
                   {savingProduct ? 'Creating...' : 'Create Product'}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE VARIANT MODAL */}
      {showVariantModal && activeProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 500 }}>
          <div className="card" style={{ width: '90%', maxWidth: '450px' }}>
            <h3 style={{ marginBottom: '16px' }}>Add Variant for {activeProduct.name}</h3>
            <form onSubmit={handleCreateVariant} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Size Selector */}
              <div className="form-group">
                <label className="form-label">Size *</label>
                <input
                  type="text"
                  className="form-control"
                  value={varSize}
                  onChange={e => setVarSize(e.target.value)}
                  required
                  placeholder="Select below or type custom size"
                  style={{ marginBottom: '8px' }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '28', '30', '32', '34', '36', '38', '40', '42'].map(s => (
                    <span
                      key={s}
                      onClick={() => setVarSize(s)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: varSize === s ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                        background: varSize === s ? 'rgba(13, 148, 136, 0.1)' : 'var(--bg-primary)',
                        color: varSize === s ? 'var(--color-primary)' : 'var(--text-secondary)',
                        transition: 'all 0.15s'
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Color Selector */}
              <div className="form-group">
                <label className="form-label">Color *</label>
                <input
                  type="text"
                  className="form-control"
                  value={varColor}
                  onChange={e => setVarColor(e.target.value)}
                  required
                  placeholder="Select below or type custom color"
                  style={{ marginBottom: '8px' }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {[
                    { label: 'White', hex: '#f8fafc' },
                    { label: 'Ivory White', hex: '#fffff0' },
                    { label: 'Black', hex: '#1a1a1a' },
                    { label: 'Classic Black', hex: '#111' },
                    { label: 'Navy Blue', hex: '#1e3a5f' },
                    { label: 'Royal Blue', hex: '#2563eb' },
                    { label: 'Sky Blue', hex: '#7dd3fc' },
                    { label: 'Red', hex: '#ef4444' },
                    { label: 'Maroon', hex: '#7f1d1d' },
                    { label: 'Pink', hex: '#f9a8d4' },
                    { label: 'Green', hex: '#16a34a' },
                    { label: 'Olive', hex: '#84794e' },
                    { label: 'Yellow', hex: '#facc15' },
                    { label: 'Orange', hex: '#f97316' },
                    { label: 'Brown', hex: '#78350f' },
                    { label: 'Beige', hex: '#d4b896' },
                    { label: 'Grey', hex: '#9ca3af' },
                    { label: 'Antique Gold', hex: '#b8860b' },
                  ].map(c => (
                    <span
                      key={c.label}
                      onClick={() => setVarColor(c.label)}
                      title={c.label}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: varColor === c.label ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                        background: varColor === c.label ? 'rgba(13, 148, 136, 0.1)' : 'var(--bg-primary)',
                        color: varColor === c.label ? 'var(--color-primary)' : 'var(--text-secondary)',
                        transition: 'all 0.15s'
                      }}
                    >
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: c.hex, border: '1px solid #ccc', flexShrink: 0 }} />
                      {c.label}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Barcode (Scan to Autofill) *</label>
                <input type="text" className="form-control" value={varBarcode} onChange={e => setVarBarcode(e.target.value)} required placeholder="Scan tag or type unique code" />
              </div>

              <div className="form-group">
                <label className="form-label">SKU (Optional)</label>
                <input type="text" className="form-control" value={varSku} onChange={e => setVarSku(e.target.value)} placeholder="Auto-generated if empty" />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Purchase Price (৳)</label>
                  <input type="number" step="0.01" className="form-control" value={varPurchasePrice || ''} onChange={e => setVarPurchasePrice(Number(e.target.value))} required placeholder="Cost Price" />
                </div>
                <div className="form-group">
                  <label className="form-label">Selling Price (৳)</label>
                  <input type="number" step="0.01" className="form-control" value={varSellingPrice || ''} onChange={e => setVarSellingPrice(Number(e.target.value))} required placeholder="Retail Price" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Min Stock Alert Level</label>
                <input type="number" className="form-control" value={varMinStock || ''} onChange={e => setVarMinStock(Number(e.target.value))} placeholder="5" />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>Alert when stock drops below this number</span>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowVariantModal(false)}>Cancel</button>
                 <button type="submit" className="btn btn-primary" disabled={savingVariant}>
                   {savingVariant ? 'Creating...' : 'Create Variant'}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
