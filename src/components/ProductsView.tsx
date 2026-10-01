import React, { useState, useEffect } from 'react';
import { dbService } from '../dbService';
import type { Product, ProductVariant } from '../store';
import { Plus, Trash2, Tag, Printer, Search } from 'lucide-react';
import { Pagination } from './Pagination';

interface ProductsViewProps {
  onRefreshStats: () => void;
}

export const generateNextBarcodes = (variantsList: { barcode?: string }[] = [], count: number = 1, extraExisting: string[] = []): string[] => {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}${month}${day}`; // e.g. "20261001"
  const reverseDate = todayStr.split('').reverse().join(''); // e.g. "10016202"

  let maxSerial = 0;
  const checkBarcode = (bc?: string) => {
    if (bc && bc.startsWith(reverseDate)) {
      const serialPart = bc.slice(reverseDate.length).replace(/^-/, '');
      const parsed = parseInt(serialPart, 10);
      if (!isNaN(parsed) && parsed > maxSerial) {
        maxSerial = parsed;
      }
    }
  };

  variantsList.forEach(v => checkBarcode(v.barcode));
  extraExisting.forEach(bc => checkBarcode(bc));

  const result: string[] = [];
  for (let i = 1; i <= count; i++) {
    result.push(`${reverseDate}${maxSerial + i}`);
  }
  return result;
};

export const generateNextBarcode = (variantsList: { barcode?: string }[] = []): string => {
  return generateNextBarcodes(variantsList, 1)[0];
};

interface VariantRowDraft {
  tempId: string;
  size: string;
  color: string;
  barcode: string;
  sku: string;
  purchase_price: number;
  selling_price: number;
  min_stock_level: number;
}

export const ProductsView: React.FC<ProductsViewProps> = ({ onRefreshStats }) => {
  const { showToast, showConfirm } = useNotificationStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [barcodeVariantModal, setBarcodeVariantModal] = useState<ProductVariant | null>(null);
  
  // Pagination and Search states
  const [prodSearch, setProdSearch] = useState('');
  const [prodPage, setProdPage] = useState(1);
  const [prodPageSize, setProdPageSize] = useState(8);
  const [varPage, setVarPage] = useState(1);
  const [varPageSize, setVarPageSize] = useState(10);

  // Forms states
  const [showProductModal, setShowProductModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [newProductBrand, setNewProductBrand] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  // Multi-variant creation states
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [variantRows, setVariantRows] = useState<VariantRowDraft[]>([]);
  const [commonColor, setCommonColor] = useState('Default');
  const [commonSellingPrice, setCommonSellingPrice] = useState<number>(0);
  const [commonPurchasePrice, setCommonPurchasePrice] = useState<number>(0);
  const [savingVariant, setSavingVariant] = useState(false);
  const [deletingVariantId, setDeletingVariantId] = useState<string | null>(null);

  const loadData = async () => {
    const [prodList, varList] = await Promise.all([
      dbService.getProducts(),
      dbService.getVariants()
    ]);
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
    } catch (err: any) {
      showToast(err?.message || 'Error creating product', 'error');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleOpenAddVariant = () => {
    const nextBc = generateNextBarcode(variants);
    setCommonColor('Default');
    setCommonSellingPrice(0);
    setCommonPurchasePrice(0);
    setVariantRows([
      {
        tempId: Math.random().toString(36).substring(2, 9),
        size: 'M',
        color: 'Default',
        barcode: nextBc,
        sku: '',
        purchase_price: 0,
        selling_price: 0,
        min_stock_level: 5
      }
    ]);
    setShowVariantModal(true);
  };

  const toggleSizeInBatch = (sizeName: string) => {
    setVariantRows(prev => {
      const exists = prev.find(r => r.size === sizeName);
      if (exists) {
        if (prev.length === 1) {
          // If only 1, don't remove, just change size or notify
          return prev.filter(r => r.tempId !== exists.tempId);
        }
        return prev.filter(r => r.tempId !== exists.tempId);
      } else {
        const existingBarcodes = prev.map(r => r.barcode);
        const [nextBc] = generateNextBarcodes(variants, 1, existingBarcodes);
        return [
          ...prev,
          {
            tempId: Math.random().toString(36).substring(2, 9),
            size: sizeName,
            color: commonColor || 'Default',
            barcode: nextBc,
            sku: '',
            purchase_price: commonPurchasePrice || 0,
            selling_price: commonSellingPrice || 0,
            min_stock_level: 5
          }
        ];
      }
    });
  };

  const handleAddCustomRow = () => {
    const existingBarcodes = variantRows.map(r => r.barcode);
    const [nextBc] = generateNextBarcodes(variants, 1, existingBarcodes);
    setVariantRows(prev => [
      ...prev,
      {
        tempId: Math.random().toString(36).substring(2, 9),
        size: 'Free Size',
        color: commonColor || 'Default',
        barcode: nextBc,
        sku: '',
        purchase_price: commonPurchasePrice || 0,
        selling_price: commonSellingPrice || 0,
        min_stock_level: 5
      }
    ]);
  };

  const handleRemoveRow = (tempId: string) => {
    setVariantRows(prev => prev.filter(r => r.tempId !== tempId));
  };

  const handleUpdateRow = (tempId: string, field: keyof VariantRowDraft, value: any) => {
    setVariantRows(prev => prev.map(r => {
      if (r.tempId === tempId) {
        return { ...r, [field]: value };
      }
      return r;
    }));
  };

  const handleApplyCommonColor = (color: string) => {
    setCommonColor(color);
    setVariantRows(prev => prev.map(r => ({ ...r, color })));
  };

  const handleApplyCommonPrice = (sellPrice: number, costPrice: number) => {
    setCommonSellingPrice(sellPrice);
    setCommonPurchasePrice(costPrice);
    setVariantRows(prev => prev.map(r => ({
      ...r,
      selling_price: sellPrice > 0 ? sellPrice : r.selling_price,
      purchase_price: costPrice > 0 ? costPrice : r.purchase_price
    })));
  };

  const handleCreateBatchVariants = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProduct) return;
    if (variantRows.length === 0) {
      showToast('Please add at least one variant row.', 'warning');
      return;
    }

    // Validate rows
    for (let i = 0; i < variantRows.length; i++) {
      const row = variantRows[i];
      if (!row.size.trim()) {
        showToast(`Row #${i + 1} is missing a Size.`, 'warning');
        return;
      }
      if (!row.color.trim()) {
        showToast(`Row #${i + 1} is missing a Color.`, 'warning');
        return;
      }
      if (!row.barcode.trim()) {
        showToast(`Row #${i + 1} is missing a Barcode.`, 'warning');
        return;
      }
      if (row.selling_price <= 0) {
        showToast(`Row #${i + 1} (${row.size}) must have a valid Selling Price.`, 'warning');
        return;
      }
    }

    // Check duplicate barcodes among rows
    const barcodesInRows = variantRows.map(r => r.barcode.trim());
    const uniqueBarcodes = new Set(barcodesInRows);
    if (uniqueBarcodes.size !== barcodesInRows.length) {
      showToast('Duplicate barcodes detected among the rows. Each row must have a unique barcode.', 'warning');
      return;
    }

    // Check duplicate barcodes against existing DB variants
    for (const row of variantRows) {
      const rawBc = row.barcode.trim().replace(/-/g, '');
      const exists = variants.find(v => v.barcode && (v.barcode === row.barcode.trim() || v.barcode.replace(/-/g, '') === rawBc));
      if (exists) {
        showToast(`Barcode "${row.barcode}" already exists in inventory! Please regenerate.`, 'warning');
        return;
      }
    }

    try {
      setSavingVariant(true);
      showToast(`Creating ${variantRows.length} variant(s)...`, 'info');

      for (const row of variantRows) {
        const generatedSku = row.sku || `${activeProduct.name.substring(0,3).toUpperCase()}-${row.color.substring(0,3).toUpperCase()}-${row.size}`;
        await dbService.saveVariant({
          product_id: activeProduct.id,
          sku: generatedSku,
          barcode: row.barcode.trim(),
          size: row.size.trim(),
          color: row.color.trim(),
          purchase_price: row.purchase_price || 0,
          selling_price: row.selling_price,
          stock_quantity: 0,
          min_stock_level: row.min_stock_level || 5
        });
      }

      setShowVariantModal(false);
      setVariantRows([]);
      await loadData();
      onRefreshStats();
      showToast(`Successfully created ${variantRows.length} variant(s)!`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error creating variants', 'error');
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
  // Filter variants for selected product
  const activeVariants = variants.filter(v => v.product_id === activeProduct?.id);
  const paginatedVariants = activeVariants.slice((varPage - 1) * varPageSize, varPage * varPageSize);

  // Filter products by search
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(prodSearch.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(prodSearch.toLowerCase())) ||
    (p.brand && p.brand.toLowerCase().includes(prodSearch.toLowerCase()))
  );
  const paginatedProducts = filteredProducts.slice((prodPage - 1) * prodPageSize, prodPage * prodPageSize);

  return (
    <div className="products-layout" style={{ alignItems: 'start' }}>
      
      {/* Product List */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: 'calc(100vh - 110px)', overflowY: 'auto', padding: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>Products</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{filteredProducts.length} items cataloged</span>
          </div>
          <button className="btn btn-primary btn-sm" style={{ padding: '4px 10px' }} onClick={() => setShowProductModal(true)}>
            <Plus size={14} /> Add Product
          </button>
        </div>

        {/* Product Search */}
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input 
            type="text" 
            className="form-control" 
            placeholder="Search by name, category, brand..."
            value={prodSearch}
            onChange={(e) => {
              setProdSearch(e.target.value);
              setProdPage(1);
            }}
            style={{ paddingLeft: '28px', height: '32px', fontSize: '12px' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, overflowY: 'auto' }}>
          {paginatedProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '12px' }}>
              No matching products found.
            </div>
          ) : (
            paginatedProducts.map(p => {
              const count = variants.filter(v => v.product_id === p.id).length;
              const isSelected = activeProduct?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setActiveProduct(p);
                    setVarPage(1);
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: isSelected ? 'var(--color-primary-light)' : 'transparent',
                    border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--border-color)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '12.5px', color: isSelected ? 'var(--color-primary)' : 'var(--text-primary)', maxWidth: '170px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }}>
                      {p.category || 'General'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <span>{p.brand || 'No brand'}</span>
                    <span style={{ fontSize: '10.5px', color: count > 0 ? 'var(--color-primary)' : '#94a3b8', fontWeight: 600 }}>
                      {count} {count === 1 ? 'Variant' : 'Variants'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {filteredProducts.length > 0 && (
          <Pagination 
            currentPage={prodPage}
            totalItems={filteredProducts.length}
            pageSize={prodPageSize}
            onPageChange={setProdPage}
            onPageSizeChange={setProdPageSize}
            pageSizeOptions={[8, 15, 25, 50, 100]}
          />
        )}
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
                  onClick={handleOpenAddVariant}
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
              <h4 style={{ marginBottom: '12px', fontSize: '15px' }}>Sizes, Colors & Barcodes ({activeVariants.length})</h4>
              
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
                      <th style={{ width: '130px', textAlign: 'center' }}>Actions</th>
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
                      paginatedVariants.map((v, idx) => (
                        <tr key={v.id}>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {(varPage - 1) * varPageSize + idx + 1}
                          </td>
                          <td style={{ fontWeight: 'bold' }}>{v.sku}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Tag size={12} style={{ color: 'var(--color-primary)' }} />
                              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v.barcode}</span>
                            </div>
                          </td>
                          <td>{v.size}</td>
                          <td>{v.color}</td>
                          <td>৳{(v.purchase_price ?? 0).toFixed(2)}</td>
                          <td>৳{(v.selling_price ?? 0).toFixed(2)}</td>
                          <td style={{ fontWeight: 600, color: v.stock_quantity <= v.min_stock_level ? 'var(--color-danger)' : 'var(--color-success)' }}>
                            {v.stock_quantity}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }} 
                                onClick={() => setBarcodeVariantModal(v)}
                                title="Print Physical Barcode Sticker"
                              >
                                <Printer size={12} /> Sticker
                              </button>
                              <button 
                                className="btn btn-danger" 
                                style={{ padding: '6px' }} 
                                onClick={() => handleDeleteVariant(v.id)} 
                                disabled={deletingVariantId === v.id}
                                title="Delete variant"
                              >
                                {deletingVariantId === v.id ? '...' : <Trash2 size={12} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <Pagination 
                  currentPage={varPage}
                  totalItems={activeVariants.length}
                  pageSize={varPageSize}
                  onPageChange={setVarPage}
                  onPageSizeChange={setVarPageSize}
                />
              </div>

              {/* Mobile Cards View */}
              <div className="mobile-cart-list" style={{ flexDirection: 'column', gap: '12px' }}>
                {activeVariants.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    No variants defined yet. Add a size/color variant to start tracking stock.
                  </div>
                ) : (
                  paginatedVariants.map(v => (
                    <div className="card" key={v.id} style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#fff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', boxShadow: 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-primary)' }}>{v.sku}</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }} 
                            onClick={() => setBarcodeVariantModal(v)}
                          >
                            <Printer size={12} /> Sticker
                          </button>
                          <button className="btn btn-danger" style={{ padding: '4px 6px', borderRadius: '4px' }} onClick={() => handleDeleteVariant(v.id)} disabled={deletingVariantId === v.id}>
                            {deletingVariantId === v.id ? '...' : <Trash2 size={12} />}
                          </button>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <span>BC: <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{v.barcode}</span></span>
                        <span>Size/Color: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{v.size} / {v.color}</span></span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', fontSize: '12px' }}>
                        <div>Cost: <span style={{ fontWeight: 700 }}>৳{(v.purchase_price ?? 0).toFixed(2)}</span></div>
                        <div>Price: <span style={{ fontWeight: 700 }}>৳{(v.selling_price ?? 0).toFixed(2)}</span></div>
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
                <Pagination 
                  currentPage={varPage}
                  totalItems={activeVariants.length}
                  pageSize={varPageSize}
                  onPageChange={setVarPage}
                  onPageSizeChange={setVarPageSize}
                />
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', maxHeight: '92vh', overflowY: 'auto', padding: '24px', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 800 }}>Add New Clothing Product</h3>
            <form onSubmit={handleCreateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Product Name *</label>
                <input type="text" className="form-control" value={newProductName} onChange={e => setNewProductName(e.target.value)} required placeholder="e.g. Slim Denim Jeans" style={{ height: '38px', fontSize: '13px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Category</label>
                  <input type="text" className="form-control" value={newProductCategory} onChange={e => setNewProductCategory(e.target.value)} placeholder="e.g. Pants" style={{ height: '38px', fontSize: '13px' }} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Brand</label>
                  <input type="text" className="form-control" value={newProductBrand} onChange={e => setNewProductBrand(e.target.value)} placeholder="e.g. Levi's" style={{ height: '38px', fontSize: '13px' }} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Description</label>
                <textarea className="form-control" value={newProductDesc} onChange={e => setNewProductDesc(e.target.value)} placeholder="Product description..." rows={3} style={{ height: 'auto', fontSize: '13px' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowProductModal(false)}>Cancel</button>
                 <button type="submit" className="btn btn-primary" disabled={savingProduct} style={{ fontWeight: 700, padding: '8px 18px' }}>
                   {savingProduct ? 'Creating...' : 'Create Product'}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE MULTI-VARIANT BATCH MODAL */}
      {showVariantModal && activeProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '1100px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', padding: '24px', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Add Variants — <span style={{ color: 'var(--color-primary)' }}>{activeProduct.name}</span>
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Select multiple sizes or colors to generate all variant rows at once with sequential barcodes.
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowVariantModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            {/* Quick Generator Toolbar */}
            <div style={{ backgroundColor: 'var(--bg-primary)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Quick Multi-Size Selector */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '8px' }}>
                  ⚡ Quick Multi-Size Selector (Click to toggle variant rows):
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {['S', 'M', 'L', 'XL', 'XXL', 'XXXL', '38', '40', '42', '44', 'Free Size'].map(s => {
                    const isSelected = variantRows.some(r => r.size === s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSizeInBatch(s)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--border-color)',
                          background: isSelected ? 'var(--color-primary)' : '#ffffff',
                          color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                          transition: 'all 0.12s'
                        }}
                      >
                        {isSelected ? `✓ ${s}` : `+ ${s}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Common Batch Inputs (Color, Retail Price, Cost Price) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '14px', alignItems: 'flex-end', paddingTop: '8px', borderTop: '1px dashed #cbd5e1' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Default Color (Applies to rows)
                  </label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={commonColor} 
                    onChange={e => handleApplyCommonColor(e.target.value)}
                    placeholder="e.g. Navy Blue, White, Black"
                    style={{ height: '36px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Selling Price (৳) *
                  </label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={commonSellingPrice || ''} 
                    onChange={e => handleApplyCommonPrice(Number(e.target.value), commonPurchasePrice)}
                    placeholder="e.g. 1250"
                    style={{ height: '36px', fontSize: '13px', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Purchase / Cost (৳) (Optional)
                  </label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={commonPurchasePrice || ''} 
                    onChange={e => handleApplyCommonPrice(commonSellingPrice, Number(e.target.value))}
                    placeholder="Cost (Optional)"
                    style={{ height: '36px', fontSize: '13px' }}
                  />
                </div>
              </div>
            </div>

            {/* Table of Variant Rows */}
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
              <table className="table" style={{ margin: 0, fontSize: '13px' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f1f5f9', zIndex: 2 }}>
                  <tr>
                    <th style={{ width: '45px', textAlign: 'center' }}>#</th>
                    <th style={{ width: '130px' }}>Size *</th>
                    <th style={{ width: '160px' }}>Color *</th>
                    <th>Barcode (Unique) *</th>
                    <th style={{ width: '130px' }}>Cost (৳)</th>
                    <th style={{ width: '140px' }}>Price (৳) *</th>
                    <th style={{ width: '50px', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {variantRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                        No variant rows selected. Click a size chip above or click <strong>"+ Add Another Row"</strong>.
                      </td>
                    </tr>
                  ) : (
                    variantRows.map((row, idx) => (
                      <tr key={row.tempId}>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>
                          {idx + 1}
                        </td>
                        <td>
                          <input 
                            type="text" 
                            className="form-control" 
                            value={row.size} 
                            onChange={e => handleUpdateRow(row.tempId, 'size', e.target.value)}
                            placeholder="Size (e.g. M)" 
                            style={{ height: '36px', fontSize: '13px', padding: '4px 8px', fontWeight: 600 }}
                          />
                        </td>
                        <td>
                          <input 
                            type="text" 
                            className="form-control" 
                            value={row.color} 
                            onChange={e => handleUpdateRow(row.tempId, 'color', e.target.value)}
                            placeholder="Color" 
                            style={{ height: '36px', fontSize: '13px', padding: '4px 8px' }}
                          />
                        </td>
                        <td>
                          <input 
                            type="text" 
                            className="form-control" 
                            value={row.barcode} 
                            onChange={e => handleUpdateRow(row.tempId, 'barcode', e.target.value)}
                            placeholder="Barcode" 
                            style={{ height: '36px', fontSize: '13px', fontFamily: 'monospace', padding: '4px 8px', fontWeight: 600 }}
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            step="0.01" 
                            className="form-control" 
                            value={row.purchase_price || ''} 
                            onChange={e => handleUpdateRow(row.tempId, 'purchase_price', Number(e.target.value))}
                            placeholder="0.00" 
                            style={{ height: '36px', fontSize: '13px', padding: '4px 8px' }}
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            step="0.01" 
                            className="form-control" 
                            value={row.selling_price || ''} 
                            onChange={e => handleUpdateRow(row.tempId, 'selling_price', Number(e.target.value))}
                            placeholder="Price *" 
                            style={{ height: '36px', fontSize: '13px', padding: '4px 8px', fontWeight: 700, borderColor: row.selling_price <= 0 ? '#fda4af' : undefined }}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn-icon text-danger"
                            onClick={() => handleRemoveRow(row.tempId)}
                            title="Remove this row"
                            style={{ padding: '6px', cursor: 'pointer' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Action Buttons Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleAddCustomRow}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '38px', padding: '0 14px', fontWeight: 600 }}
              >
                <Plus size={15} /> Add Another Row
              </button>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowVariantModal(false)} style={{ height: '38px', padding: '0 16px' }}>
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleCreateBatchVariants} 
                  disabled={savingVariant || variantRows.length === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, height: '38px', padding: '0 20px' }}
                >
                  {savingVariant ? 'Saving...' : `Create ${variantRows.length} ${variantRows.length === 1 ? 'Variant' : 'Variants'}`}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* BARCODE STICKER LABEL MODAL */}
      {barcodeVariantModal && activeProduct && (
        <BarcodeLabelModal 
          variant={barcodeVariantModal} 
          productName={activeProduct.name} 
          onClose={() => setBarcodeVariantModal(null)} 
        />
      )}

    </div>
  );
};

