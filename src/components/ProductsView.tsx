import React, { useState, useEffect, useRef } from 'react';
import { dbService } from '../dbService';
import type { Product, ProductVariant } from '../store';
import { useNotificationStore } from '../store';
import { Plus, Trash2, Tag, Printer, Search, Edit3, Boxes, Check, ChevronDown } from 'lucide-react';
import { BarcodeLabelModal, printVariantsBatchLabels } from './BarcodeLabelModal';
import { StockAdjustmentModal } from './StockAdjustmentModal';
import { Pagination } from './Pagination';

interface ProductsViewProps {
  onRefreshStats: () => void;
}

const getReverseDate = (): string => {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}${month}${day}`; // e.g. "20261002"
  return todayStr.split('').reverse().join(''); // e.g. "20016202"
};

const getNextSerialForBundle = (
  variantsList: { barcode?: string }[],
  reverseDate: string,
  bundleNo: string | number
): number => {
  const b = (bundleNo?.toString().trim()) || '1';
  const prefix = `${reverseDate}-${b}-`;
  let maxSerial = 0;
  for (const v of variantsList) {
    if (v.barcode && v.barcode.startsWith(prefix)) {
      const serialPart = v.barcode.substring(prefix.length);
      const parsed = parseInt(serialPart, 10);
      if (!isNaN(parsed) && parsed > maxSerial) {
        maxSerial = parsed;
      }
    }
  }
  return maxSerial + 1;
};

const GENTS_CATEGORIES: string[] = [
  'T-Shirt',
  'Polo Shirt',
  'Casual Shirt',
  'Formal Shirt',
  'Panjabi / Kurta',
  'Sherwani',
  'Jeans Pant',
  'Gabardine / Chino Pant',
  'Formal Pant / Trouser',
  'Cargo Pant',
  'Joggers / Track Pant',
  'Shorts',
  'Hoodie / Sweatshirt',
  'Jacket / Blazer',
  'Sweater',
  'Pajama / Lungi',
  'Underwear / Innerwear',
  'Belt & Wallet',
  'Shoes / Footwear',
  'Cap / Accessories'
];

interface ColorOption {
  name: string;
  hex: string;
}

const COLOR_PRESETS: ColorOption[] = [
  { name: 'None', hex: 'transparent' },
  { name: 'Black', hex: '#111827' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Navy Blue', hex: '#1e3a8a' },
  { name: 'Royal Blue', hex: '#2563eb' },
  { name: 'Sky Blue', hex: '#38bdf8' },
  { name: 'Red', hex: '#dc2626' },
  { name: 'Maroon', hex: '#881337' },
  { name: 'Dark Green', hex: '#166534' },
  { name: 'Olive Green', hex: '#4d7c0f' },
  { name: 'Grey', hex: '#64748b' },
  { name: 'Charcoal', hex: '#334155' },
  { name: 'Beige', hex: '#d4b996' },
  { name: 'Cream', hex: '#fef3c7' },
  { name: 'Brown', hex: '#78350f' },
  { name: 'Tan', hex: '#d97706' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Mustard', hex: '#ca8a04' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Purple', hex: '#9333ea' }
];

interface ColorComboboxProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

const ColorCombobox: React.FC<ColorComboboxProps> = ({ value, onChange, placeholder = 'Select / Type', style }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updatePosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const modal = containerRef.current.closest('.card') || document.body;
      const modalRect = modal.getBoundingClientRect();
      const spaceBelowInModal = modalRect.bottom - rect.bottom;
      const spaceBelowInWindow = window.innerHeight - rect.bottom;
      
      const shouldOpenUp = (spaceBelowInModal < 155 || spaceBelowInWindow < 155) && (rect.top > modalRect.top + 60);
      setOpenUpwards(shouldOpenUp);
    }
  };

  const toggleDropdown = () => {
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(prev => !prev);
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    updatePosition();
    setIsOpen(true);
    e.target.select();
  };

  // Show all presets if value matches an existing preset or is empty, or filter if actively typing a custom search
  const isExactPreset = COLOR_PRESETS.some(c => c.name.toLowerCase() === (value || '').trim().toLowerCase());
  const filtered = (isExactPreset || !value)
    ? COLOR_PRESETS
    : COLOR_PRESETS.filter(c => 
        c.name.toLowerCase().includes(value.toLowerCase()) || c.name === 'None'
      );

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', boxSizing: 'border-box', ...style }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
        <input
          type="text"
          className="form-control"
          value={value}
          onChange={e => {
            onChange(e.target.value);
            updatePosition();
            setIsOpen(true);
          }}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          style={{ width: '100%', boxSizing: 'border-box', minWidth: 0, height: '28px', fontSize: '12px', paddingRight: '22px', paddingLeft: '8px' }}
        />
        <button
          type="button"
          onClick={toggleDropdown}
          tabIndex={-1}
          style={{
            position: 'absolute',
            right: '2px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '3px',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <ChevronDown size={12} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: openUpwards ? 'auto' : 'calc(100% + 2px)',
            bottom: openUpwards ? 'calc(100% + 2px)' : 'auto',
            left: 0,
            width: '185px',
            zIndex: 9999,
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            boxShadow: '0 8px 20px -4px rgba(0,0,0,0.2), 0 4px 8px -4px rgba(0,0,0,0.1)',
            maxHeight: '145px',
            overflowY: 'auto',
            padding: '3px'
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Custom color: <strong>"{value}"</strong>
            </div>
          ) : (
            filtered.map(color => {
              const isSelected = value?.toLowerCase() === color.name.toLowerCase();
              return (
                <div
                  key={color.name}
                  onClick={() => {
                    onChange(color.name);
                    setIsOpen(false);
                  }}
                  style={{
                    padding: '5px 8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    borderRadius: '5px',
                    backgroundColor: isSelected ? 'var(--color-primary-light, #eff6ff)' : 'transparent',
                    color: isSelected ? 'var(--color-primary, #2563eb)' : 'var(--text-primary)',
                    fontWeight: isSelected ? 700 : 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    marginBottom: '1px'
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {color.name === 'None' ? (
                      <span style={{ 
                        width: '13px', 
                        height: '13px', 
                        borderRadius: '50%', 
                        border: '1.5px dashed #94a3b8', 
                        display: 'inline-block' 
                      }} />
                    ) : (
                      <span style={{ 
                        width: '13px', 
                        height: '13px', 
                        borderRadius: '50%', 
                        backgroundColor: color.hex, 
                        border: color.name === 'White' || color.name === 'Cream' ? '1px solid #cbd5e1' : '1px solid rgba(0,0,0,0.1)',
                        display: 'inline-block',
                        flexShrink: 0
                      }} />
                    )}
                    <span>{color.name}</span>
                  </div>
                  {isSelected && <span style={{ fontSize: '12px', fontWeight: 800 }}>✓</span>}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

const SIZE_PRESETS = [
  'XS',
  'S',
  'M',
  'L',
  'XL',
  'XXL',
  'XXXL',
  '4XL',
  '5XL',
  'Free Size',
  'One Size',
  // Numeric Pant / Waist / Shoe Sizes
  '24',
  '26',
  '28',
  '30',
  '31',
  '32',
  '33',
  '34',
  '35',
  '36',
  '37',
  '38',
  '39',
  '40',
  '41',
  '42',
  '44',
  '46',
  '48',
  '50',
  '52',
  '54'
];

interface SizeComboboxProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

const SizeCombobox: React.FC<SizeComboboxProps> = ({ value, onChange, placeholder = 'Size', style }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updatePosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const modal = containerRef.current.closest('.card') || document.body;
      const modalRect = modal.getBoundingClientRect();
      const spaceBelowInModal = modalRect.bottom - rect.bottom;
      const spaceBelowInWindow = window.innerHeight - rect.bottom;
      
      const shouldOpenUp = (spaceBelowInModal < 155 || spaceBelowInWindow < 155) && (rect.top > modalRect.top + 60);
      setOpenUpwards(shouldOpenUp);
    }
  };

  const toggleDropdown = () => {
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(prev => !prev);
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    updatePosition();
    setIsOpen(true);
    e.target.select();
  };

  const isExactPreset = SIZE_PRESETS.some(s => s.toLowerCase() === (value || '').trim().toLowerCase());
  const filtered = (isExactPreset || !value)
    ? SIZE_PRESETS
    : SIZE_PRESETS.filter(s => s.toLowerCase().includes(value.toLowerCase()));

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', boxSizing: 'border-box', ...style }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
        <input
          type="text"
          className="form-control"
          value={value}
          onChange={e => {
            onChange(e.target.value);
            updatePosition();
            setIsOpen(true);
          }}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          style={{ width: '100%', boxSizing: 'border-box', minWidth: 0, height: '28px', fontSize: '12px', fontWeight: 700, paddingRight: '22px', paddingLeft: '8px' }}
          required
        />
        <button
          type="button"
          onClick={toggleDropdown}
          tabIndex={-1}
          style={{
            position: 'absolute',
            right: '2px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '3px',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <ChevronDown size={12} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: openUpwards ? 'auto' : 'calc(100% + 2px)',
            bottom: openUpwards ? 'calc(100% + 2px)' : 'auto',
            left: 0,
            width: '120px',
            zIndex: 9999,
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            boxShadow: '0 8px 20px -4px rgba(0,0,0,0.2), 0 4px 8px -4px rgba(0,0,0,0.1)',
            maxHeight: '145px',
            overflowY: 'auto',
            padding: '3px'
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '6px 8px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
              Custom: <strong>"{value}"</strong>
            </div>
          ) : (
            filtered.map(size => {
              const isSelected = value?.toLowerCase() === size.toLowerCase();
              return (
                <div
                  key={size}
                  onClick={() => {
                    onChange(size);
                    setIsOpen(false);
                  }}
                  style={{
                    padding: '5px 8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    borderRadius: '5px',
                    backgroundColor: isSelected ? 'var(--color-primary-light, #eff6ff)' : 'transparent',
                    color: isSelected ? 'var(--color-primary, #2563eb)' : 'var(--text-primary)',
                    fontWeight: isSelected ? 800 : 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1px'
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span>{size}</span>
                  {isSelected && <span style={{ fontSize: '11px', fontWeight: 800 }}>✓</span>}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

interface VariantRowDraft {
  tempId: string;
  size: string;
  color: string;
  barcode: string;
  sku: string;
  purchase_price: number;
  selling_price: number;
  stock_quantity: number;
  min_stock_level: number;
}

export const ProductsView: React.FC<ProductsViewProps> = ({ onRefreshStats }) => {
  const { showToast, showConfirm } = useNotificationStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [barcodeVariantModal, setBarcodeVariantModal] = useState<ProductVariant | null>(null);
  const [adjustingStockVariant, setAdjustingStockVariant] = useState<ProductVariant | null>(null);
  const [createdVariantsForPrint, setCreatedVariantsForPrint] = useState<{
    productName: string;
    variants: ProductVariant[];
    copiesMode: 'single' | 'stock';
  } | null>(null);
  
  // Pagination and Search states
  const [prodSearch, setProdSearch] = useState('');
  const [prodPage, setProdPage] = useState(1);
  const [prodPageSize, setProdPageSize] = useState(8);
  const [varPage, setVarPage] = useState(1);
  const [varPageSize, setVarPageSize] = useState(10);

  // Forms states (Product Create & Edit)
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productFormName, setProductFormName] = useState('');
  const [productFormCategory, setProductFormCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [productFormBrand, setProductFormBrand] = useState('');
  const [productFormDesc, setProductFormDesc] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  // Multi-variant creation states with Bundle Number
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [bundleNumber, setBundleNumber] = useState('1');
  const [variantRows, setVariantRows] = useState<VariantRowDraft[]>([]);
  const [copyCostToAll, setCopyCostToAll] = useState(false);
  const [copyPriceToAll, setCopyPriceToAll] = useState(false);
  const [savingVariant, setSavingVariant] = useState(false);
  const [deletingVariantId, setDeletingVariantId] = useState<string | null>(null);

  // Edit Variant / Stock Modal state
  const [editVariantModal, setEditVariantModal] = useState<ProductVariant | null>(null);
  const [editSku, setEditSku] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editSize, setEditSize] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editCostPrice, setEditCostPrice] = useState<number>(0);
  const [editSellPrice, setEditSellPrice] = useState<number>(0);
  const [editStockQty, setEditStockQty] = useState<number>(0);
  const [editMinStock, setEditMinStock] = useState<number>(5);
  const [savingEditVariant, setSavingEditVariant] = useState(false);

  const loadData = async () => {
    const [prodList, varList] = await Promise.all([
      dbService.getProducts(),
      dbService.getVariants()
    ]);
    setProducts(prodList);
    setVariants(varList);
    if (prodList.length > 0) {
      if (!activeProduct || !prodList.find(p => p.id === activeProduct.id)) {
        setActiveProduct(prodList[0]);
      }
    } else {
      setActiveProduct(null);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductFormName('');
    setProductFormCategory('');
    setIsCustomCategory(false);
    setCustomCategoryInput('');
    setProductFormBrand('');
    setProductFormDesc('');
    setShowProductModal(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProductFormName(prod.name);
    const cat = prod.category || '';
    setProductFormCategory(cat);
    const isPreset = GENTS_CATEGORIES.includes(cat);
    if (cat && !isPreset) {
      setIsCustomCategory(true);
      setCustomCategoryInput(cat);
    } else {
      setIsCustomCategory(false);
      setCustomCategoryInput('');
    }
    setProductFormBrand(prod.brand || '');
    setProductFormDesc(prod.description || '');
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productFormName.trim()) return;

    const finalCategory = (isCustomCategory ? customCategoryInput : productFormCategory).trim();

    try {
      setSavingProduct(true);
      showToast(editingProduct ? 'Updating product...' : 'Creating product...', 'info');
      const prod = await dbService.saveProduct({
        ...(editingProduct ? { id: editingProduct.id } : {}),
        name: productFormName.trim(),
        category: finalCategory,
        brand: productFormBrand.trim(),
        description: productFormDesc.trim()
      });
      setShowProductModal(false);
      setEditingProduct(null);
      setProductFormName('');
      setProductFormCategory('');
      setIsCustomCategory(false);
      setCustomCategoryInput('');
      setProductFormBrand('');
      setProductFormDesc('');
      await loadData();
      setActiveProduct(prod);
      onRefreshStats();
      showToast(editingProduct ? 'Product updated successfully!' : 'Product created successfully!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error saving product', 'error');
    } finally {
      setSavingProduct(false);
    }
  };


  const handleOpenAddVariant = () => {
    const rev = getReverseDate();
    const defaultBundle = '1';
    setBundleNumber(defaultBundle);
    setCopyCostToAll(false);
    setCopyPriceToAll(false);

    const startSerial = getNextSerialForBundle(variants, rev, defaultBundle);
    setVariantRows([
      {
        tempId: Math.random().toString(36).substring(2, 9),
        size: 'M',
        color: '',
        barcode: `${rev}-${defaultBundle}-${startSerial}`,
        sku: '',
        purchase_price: 0,
        selling_price: 0,
        stock_quantity: 1,
        min_stock_level: 5
      }
    ]);
    setShowVariantModal(true);
  };

  const handleBundleNumberChange = (newBundle: string) => {
    setBundleNumber(newBundle);
    const rev = getReverseDate();
    const b = newBundle.trim() || '1';
    const startSerial = getNextSerialForBundle(variants, rev, b);
    setVariantRows(prev => prev.map((r, idx) => ({
      ...r,
      barcode: `${rev}-${b}-${startSerial + idx}`
    })));
  };

  const handleToggleCopyCost = (checked: boolean) => {
    setCopyCostToAll(checked);
    if (checked && variantRows.length > 0) {
      const firstCost = variantRows[0].purchase_price || 0;
      setVariantRows(prev => prev.map(r => ({ ...r, purchase_price: firstCost })));
    }
  };

  const handleToggleCopyPrice = (checked: boolean) => {
    setCopyPriceToAll(checked);
    if (checked && variantRows.length > 0) {
      const firstPrice = variantRows[0].selling_price || 0;
      setVariantRows(prev => prev.map(r => ({ ...r, selling_price: firstPrice })));
    }
  };

  const handleAddRowWithSize = (sizeName: string) => {
    const rev = getReverseDate();
    const b = bundleNumber.trim() || '1';
    const startSerial = getNextSerialForBundle(variants, rev, b);
    setVariantRows(prev => {
      const newIndex = prev.length;
      const firstCost = prev.length > 0 ? (prev[0].purchase_price || 0) : 0;
      const firstPrice = prev.length > 0 ? (prev[0].selling_price || 0) : 0;
      return [
        ...prev,
        {
          tempId: Math.random().toString(36).substring(2, 9),
          size: sizeName,
          color: '',
          barcode: `${rev}-${b}-${startSerial + newIndex}`,
          sku: '',
          purchase_price: copyCostToAll ? firstCost : 0,
          selling_price: copyPriceToAll ? firstPrice : 0,
          stock_quantity: 1,
          min_stock_level: 5
        }
      ];
    });
  };

  const handleAddEmptyRow = () => {
    handleAddRowWithSize('');
  };

  const handleRemoveRow = (tempId: string) => {
    const rev = getReverseDate();
    const b = bundleNumber.trim() || '1';
    const startSerial = getNextSerialForBundle(variants, rev, b);
    setVariantRows(prev => {
      const filtered = prev.filter(r => r.tempId !== tempId);
      return filtered.map((r, idx) => ({
        ...r,
        barcode: `${rev}-${b}-${startSerial + idx}`
      }));
    });
  };

  const handleUpdateRow = (tempId: string, field: keyof VariantRowDraft, value: any) => {
    setVariantRows(prev => {
      const isFirstRow = prev.length > 0 && prev[0].tempId === tempId;
      return prev.map(r => {
        if (r.tempId === tempId) {
          return { ...r, [field]: value };
        }
        if (isFirstRow && field === 'purchase_price' && copyCostToAll) {
          return { ...r, purchase_price: value };
        }
        if (isFirstRow && field === 'selling_price' && copyPriceToAll) {
          return { ...r, selling_price: value };
        }
        return r;
      });
    });
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

      const createdList: ProductVariant[] = [];
      for (const row of variantRows) {
        const finalColor = row.color.trim() || 'None';
        const generatedSku = row.sku || `${activeProduct.name.substring(0,3).toUpperCase()}-${finalColor.substring(0,3).toUpperCase()}-${row.size}`;
        const saved = await dbService.saveVariant({
          product_id: activeProduct.id,
          sku: generatedSku,
          barcode: row.barcode.trim(),
          size: row.size.trim(),
          color: finalColor,
          purchase_price: row.purchase_price || 0,
          selling_price: row.selling_price,
          stock_quantity: Math.max(0, Number(row.stock_quantity) || 0),
          min_stock_level: row.min_stock_level || 5
        });
        if (saved) {
          createdList.push(saved);
        }
      }

      setShowVariantModal(false);
      setVariantRows([]);
      await loadData();
      onRefreshStats();
      showToast(`Successfully created ${createdList.length} variant(s)!`, 'success');

      if (createdList.length > 0) {
        setCreatedVariantsForPrint({
          productName: activeProduct.name,
          variants: createdList,
          copiesMode: 'single'
        });
      }
    } catch (err: any) {
      showToast(err?.message || 'Error creating variants', 'error');
    } finally {
      setSavingVariant(false);
    }
  };

  const handleOpenEditVariant = (v: ProductVariant) => {
    setEditVariantModal(v);
    setEditSku(v.sku);
    setEditBarcode(v.barcode);
    setEditSize(v.size);
    setEditColor(v.color);
    setEditCostPrice(v.purchase_price ?? 0);
    setEditSellPrice(v.selling_price ?? 0);
    setEditStockQty(v.stock_quantity ?? 0);
    setEditMinStock(v.min_stock_level ?? 5);
  };

  const handleSaveEditVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVariantModal) return;

    if (!editBarcode.trim()) {
      showToast('Barcode cannot be empty.', 'warning');
      return;
    }
    if (editSellPrice <= 0) {
      showToast('Selling price must be greater than zero.', 'warning');
      return;
    }

    try {
      setSavingEditVariant(true);
      showToast('Saving variant & stock update...', 'info');

      const oldStock = editVariantModal.stock_quantity ?? 0;
      const newStock = Math.max(0, Number(editStockQty) || 0);

      // Save variant updates
      await dbService.saveVariant({
        id: editVariantModal.id,
        product_id: editVariantModal.product_id,
        sku: editSku.trim() || editVariantModal.sku,
        barcode: editBarcode.trim(),
        size: editSize.trim() || editVariantModal.size,
        color: editColor.trim() || editVariantModal.color,
        purchase_price: Math.max(0, Number(editCostPrice) || 0),
        selling_price: Number(editSellPrice),
        stock_quantity: newStock,
        min_stock_level: Math.max(0, Number(editMinStock) || 0)
      });

      // If stock changed on existing variant, adjust stock ledger
      if (newStock !== oldStock) {
        await dbService.adjustStock(editVariantModal.id, newStock, `Manual stock edit from Product catalog (${oldStock} -> ${newStock})`);
      }

      setEditVariantModal(null);
      await loadData();
      onRefreshStats();
      showToast('Variant and stock updated successfully!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update variant', 'error');
    } finally {
      setSavingEditVariant(false);
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
  const paginatedVariants = activeVariants.slice((varPage - 1) * varPageSize, varPage * varPageSize);

  // Filter products by search (Supports Name, Category, Brand, SKU, and Barcode Scanning)
  const filteredProducts = products.filter(p => {
    if (!prodSearch.trim()) return true;
    const q = prodSearch.trim().toLowerCase();
    const rawQ = q.replace(/-/g, '');

    // 1. Direct product match
    if (
      p.name.toLowerCase().includes(q) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q))
    ) {
      return true;
    }

    // 2. Barcode or SKU match across its variants
    const match = variants.find(v => {
      if (v.product_id !== p.id) return false;
      const bc = (v.barcode || '').toLowerCase();
      const rawBc = bc.replace(/-/g, '');
      const sku = (v.sku || '').toLowerCase();
      return bc.includes(q) || rawBc.includes(rawQ) || sku.includes(q);
    });

    return !!match;
  });
  const paginatedProducts = filteredProducts.slice((prodPage - 1) * prodPageSize, prodPage * prodPageSize);

  const handleBarcodeOrSearchSubmit = (val: string) => {
    const q = val.trim();
    if (!q) return;
    const rawQ = q.replace(/-/g, '').toLowerCase();

    // Look for exact or partial barcode / SKU match in all variants
    const match = variants.find(v => {
      const bc = (v.barcode || '').toLowerCase();
      const rawBc = bc.replace(/-/g, '');
      const sku = (v.sku || '').toLowerCase();
      return bc === q.toLowerCase() || rawBc === rawQ || sku === q.toLowerCase() || bc.includes(q.toLowerCase());
    });

    if (match) {
      const parentProd = products.find(p => p.id === match.product_id);
      if (parentProd) {
        setActiveProduct(parentProd);
        setVarPage(1);
        showToast(`Found: ${parentProd.name} (${match.size}/${match.color}) - ${match.barcode}`, 'success');
      }
    }
  };

  return (
    <div className="products-layout" style={{ alignItems: 'start' }}>
      
      {/* Product List */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: 'calc(100vh - 110px)', overflowY: 'auto', padding: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>Products</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{filteredProducts.length} items cataloged</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button className="btn btn-primary btn-sm" style={{ padding: '4px 10px' }} onClick={handleOpenAddProduct}>
              <Plus size={14} /> Add Product
            </button>
          </div>
        </div>

        {/* Product & Barcode Search */}
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input 
            type="text" 
            className="form-control" 
            placeholder="Search name, brand, or scan barcode..."
            value={prodSearch}
            onChange={(e) => {
              const val = e.target.value;
              setProdSearch(val);
              setProdPage(1);
              if (val.length >= 8) {
                const rawVal = val.trim().replace(/-/g, '');
                const found = variants.find(v => (v.barcode && (v.barcode.replace(/-/g, '') === rawVal || v.barcode === val.trim())));
                if (found) {
                  const parent = products.find(p => p.id === found.product_id);
                  if (parent && parent.id !== activeProduct?.id) {
                    setActiveProduct(parent);
                  }
                }
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleBarcodeOrSearchSubmit(prodSearch);
              }
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }}>
                        {p.category || 'General'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditProduct(p);
                        }}
                        title="Edit product details"
                        style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: 'var(--text-muted)' }}
                      >
                        <Edit3 size={12} />
                      </button>
                    </div>
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
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => handleOpenEditProduct(activeProduct)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                  title="Edit Product Details"
                >
                  <Edit3 size={15} /> Edit Product
                </button>
                {activeVariants.length > 0 && (
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setAdjustingStockVariant(activeVariants[0])}
                    style={{ border: '1.5px solid #86efac', color: '#166534', backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                    title="Adjust Stock"
                  >
                    <Boxes size={16} /> Adjust Stock
                  </button>
                )}
                <button 
                  className="btn btn-secondary" 
                  onClick={handleOpenAddVariant}
                  style={{ border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}
                >
                  <Plus size={16} /> Add Variant
                </button>
                <button className="btn btn-danger" style={{ padding: '8px' }} onClick={() => handleDeleteProduct(activeProduct.id)} disabled={deletingProductId === activeProduct.id} title="Delete Product">
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
                      <th style={{ width: '210px', textAlign: 'center' }}>Actions</th>
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
                          <td>
                            <button
                              type="button"
                              onClick={() => setAdjustingStockVariant(v)}
                              title="Click to adjust stock"
                              style={{
                                border: '1px solid',
                                borderColor: v.stock_quantity <= v.min_stock_level ? '#fca5a5' : '#86efac',
                                background: v.stock_quantity <= v.min_stock_level ? 'rgba(244, 63, 94, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                                color: v.stock_quantity <= v.min_stock_level ? 'var(--color-danger)' : 'var(--color-success)',
                                fontWeight: 800,
                                padding: '4px 12px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12.5px'
                              }}
                            >
                              {v.stock_quantity}
                            </button>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: '#166534', backgroundColor: '#f0fdf4', borderColor: '#86efac' }} 
                                onClick={() => setAdjustingStockVariant(v)}
                                title="Adjust Stock"
                              >
                                <Boxes size={12} /> Stock
                              </button>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }} 
                                onClick={() => handleOpenEditVariant(v)}
                                title="Edit Variant Details"
                              >
                                <Edit3 size={12} /> Edit
                              </button>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }} 
                                onClick={() => setBarcodeVariantModal(v)}
                                title="Print Physical Barcode Sticker"
                              >
                                <Printer size={12} />
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
                            style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: '#166534', backgroundColor: '#f0fdf4', borderColor: '#86efac' }} 
                            onClick={() => setAdjustingStockVariant(v)}
                            title="Adjust Stock"
                          >
                            <Boxes size={12} /> Stock
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }} 
                            onClick={() => handleOpenEditVariant(v)}
                            title="Edit Details"
                          >
                            <Edit3 size={12} /> Edit
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }} 
                            onClick={() => setBarcodeVariantModal(v)}
                          >
                            <Printer size={12} />
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
                        
                        <button
                          type="button"
                          onClick={() => setAdjustingStockVariant(v)}
                          style={{
                            border: '1px solid #86efac',
                            fontWeight: 800,
                            padding: '3px 10px',
                            borderRadius: '5px',
                            fontSize: '11.5px',
                            backgroundColor: v.stock_quantity <= v.min_stock_level ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: v.stock_quantity <= v.min_stock_level ? 'var(--color-danger)' : 'var(--color-success)',
                            cursor: 'pointer'
                          }}
                        >
                          Stock: {v.stock_quantity}
                        </button>
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

      {/* CREATE / EDIT MOTHER PRODUCT MODAL */}
      {showProductModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', maxHeight: '92vh', overflowY: 'auto', padding: '24px', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={18} style={{ color: 'var(--color-primary)' }} />
                {editingProduct ? 'Edit Product' : 'Add New Clothing Product'}
              </h3>
              <button 
                type="button" 
                onClick={() => setShowProductModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Product Name *</label>
                <input type="text" className="form-control" value={productFormName} onChange={e => setProductFormName(e.target.value)} required placeholder="e.g. Slim Denim Jeans" style={{ height: '38px', fontSize: '13px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'start' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Category</label>
                  <select
                    className="form-control"
                    value={isCustomCategory ? '__CUSTOM__' : (productFormCategory || '')}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__CUSTOM__') {
                        setIsCustomCategory(true);
                        setProductFormCategory(customCategoryInput);
                      } else {
                        setIsCustomCategory(false);
                        setProductFormCategory(val);
                      }
                    }}
                    style={{ height: '38px', fontSize: '13px' }}
                  >
                    <option value="">-- Select Category --</option>
                    {GENTS_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="__CUSTOM__">✏️ Other / Custom Category...</option>
                  </select>
                  {isCustomCategory && (
                    <input
                      type="text"
                      className="form-control"
                      value={customCategoryInput}
                      onChange={(e) => {
                        setCustomCategoryInput(e.target.value);
                        setProductFormCategory(e.target.value);
                      }}
                      placeholder="Type custom category name..."
                      autoFocus
                      style={{ height: '36px', fontSize: '13px', marginTop: '6px' }}
                    />
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Brand</label>
                  <input type="text" className="form-control" value={productFormBrand} onChange={e => setProductFormBrand(e.target.value)} placeholder="e.g. Levi's" style={{ height: '38px', fontSize: '13px' }} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Description</label>
                <textarea className="form-control" value={productFormDesc} onChange={e => setProductFormDesc(e.target.value)} placeholder="Product description..." rows={3} style={{ height: 'auto', fontSize: '13px' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowProductModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingProduct} style={{ fontWeight: 700, padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={16} />
                  {savingProduct ? 'Saving...' : (editingProduct ? 'Save Changes' : 'Create Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE MULTI-VARIANT BATCH MODAL */}
      {showVariantModal && activeProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '12px' }}>
          <div className="card" style={{ width: '95vw', maxWidth: '920px', display: 'flex', flexDirection: 'column', padding: '14px 18px', borderRadius: 'var(--radius-md)', boxShadow: '0 20px 50px rgba(0,0,0,0.25)', overflow: 'visible' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                Add Variants — <span style={{ color: 'var(--color-primary)' }}>{activeProduct.name}</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setShowVariantModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px', padding: '2px 6px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'visible' }}>
              
              {/* Top Section: Bundle Number & Quick Auto-Fill */}
              <div style={{ backgroundColor: '#f8fafc', padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                
                {/* Bundle Number */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b' }}>
                    Bundle No:
                  </label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={bundleNumber} 
                    onChange={e => handleBundleNumberChange(e.target.value)}
                    placeholder="1"
                    style={{ 
                      width: '60px', 
                      height: '28px', 
                      fontSize: '13px', 
                      fontWeight: 800, 
                      textAlign: 'center',
                      borderColor: 'var(--color-primary)',
                      backgroundColor: '#ffffff',
                      padding: '2px 4px'
                    }}
                  />
                </div>

                {/* Quick Add Size Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginRight: '2px' }}>
                    + Size:
                  </span>
                  {['S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Free Size'].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleAddRowWithSize(s)}
                      style={{
                        padding: '2px 7px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: '1px solid var(--border-color)',
                        backgroundColor: '#ffffff',
                        color: 'var(--text-secondary)',
                        transition: 'all 0.12s'
                      }}
                    >
                      + {s}
                    </button>
                  ))}
                </div>

              </div>

              {/* Variants Separate Rows Table */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'visible', width: '100%', boxSizing: 'border-box' }}>
                <table style={{ width: '100%', tableLayout: 'fixed', margin: 0, fontSize: '12px', borderCollapse: 'collapse' }}>
                  <colgroup>
                    <col style={{ width: '32px' }} />
                    <col style={{ width: '90px' }} />
                    <col style={{ width: '130px' }} />
                    <col style={{ width: '170px' }} />
                    <col style={{ width: '110px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '75px' }} />
                    <col style={{ width: '35px' }} />
                  </colgroup>
                  <thead style={{ backgroundColor: '#f1f5f9' }}>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ textAlign: 'center', padding: '6px 4px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>#</th>
                      <th style={{ padding: '6px 8px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>Size *</th>
                      <th style={{ padding: '6px 8px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>Color *</th>
                      <th style={{ padding: '6px 8px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>Barcode *</th>
                      <th style={{ padding: '6px 8px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                          <span>Cost (৳)</span>
                          <label title="Copy Row #1 Cost to all below rows" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'pointer', fontSize: '10.5px', color: 'var(--color-primary)', fontWeight: 700, margin: 0 }}>
                            <input
                              type="checkbox"
                              checked={copyCostToAll}
                              onChange={e => handleToggleCopyCost(e.target.checked)}
                              style={{ cursor: 'pointer', margin: 0 }}
                            />
                            <span>All</span>
                          </label>
                        </div>
                      </th>
                      <th style={{ padding: '6px 8px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                          <span>Price (৳) *</span>
                          <label title="Copy Row #1 Price to all below rows" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'pointer', fontSize: '10.5px', color: 'var(--color-primary)', fontWeight: 700, margin: 0 }}>
                            <input
                              type="checkbox"
                              checked={copyPriceToAll}
                              onChange={e => handleToggleCopyPrice(e.target.checked)}
                              style={{ cursor: 'pointer', margin: 0 }}
                            />
                            <span>All</span>
                          </label>
                        </div>
                      </th>
                      <th style={{ padding: '6px 8px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>Stock</th>
                      <th style={{ textAlign: 'center', padding: '6px 4px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {variantRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                          No variants added yet. Click size buttons above or click <strong>"+"</strong> button.
                        </td>
                      </tr>
                    ) : (
                      variantRows.map((row, idx) => (
                        <tr key={row.tempId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', padding: '5px 4px' }}>
                            {idx + 1}
                          </td>
                          <td style={{ position: 'relative', overflow: 'visible', padding: '5px 8px' }}>
                            <SizeCombobox
                              value={row.size}
                              onChange={val => handleUpdateRow(row.tempId, 'size', val)}
                              placeholder="Size"
                            />
                          </td>
                          <td style={{ position: 'relative', overflow: 'visible', padding: '5px 8px' }}>
                            <ColorCombobox
                              value={row.color}
                              onChange={val => handleUpdateRow(row.tempId, 'color', val)}
                              placeholder="Color"
                            />
                          </td>
                          <td style={{ padding: '5px 8px' }}>
                            <input 
                              type="text" 
                              className="form-control" 
                              value={row.barcode} 
                              onChange={e => handleUpdateRow(row.tempId, 'barcode', e.target.value)}
                              placeholder="Barcode" 
                              style={{ width: '100%', boxSizing: 'border-box', height: '28px', fontSize: '11.5px', fontFamily: 'monospace', fontWeight: 600, backgroundColor: '#f8fafc', padding: '2px 8px' }}
                              required
                            />
                          </td>
                          <td style={{ padding: '5px 8px' }}>
                            <input 
                              type="number" 
                              step="0.01" 
                              className="form-control" 
                              value={row.purchase_price || ''} 
                              onChange={e => handleUpdateRow(row.tempId, 'purchase_price', Number(e.target.value))}
                              placeholder="0.00" 
                              style={{ width: '100%', boxSizing: 'border-box', height: '28px', fontSize: '12px', padding: '2px 8px' }}
                            />
                          </td>
                          <td style={{ padding: '5px 8px' }}>
                            <input 
                              type="number" 
                              step="0.01" 
                              className="form-control" 
                              value={row.selling_price || ''} 
                              onChange={e => handleUpdateRow(row.tempId, 'selling_price', Number(e.target.value))}
                              placeholder="Price *" 
                              style={{ width: '100%', boxSizing: 'border-box', height: '28px', fontSize: '12px', fontWeight: 700, borderColor: row.selling_price <= 0 ? '#fda4af' : undefined, padding: '2px 8px' }}
                              required
                            />
                          </td>
                          <td style={{ padding: '5px 8px' }}>
                            <input 
                              type="number" 
                              min="0" 
                              className="form-control" 
                              value={row.stock_quantity ?? ''} 
                              onChange={e => handleUpdateRow(row.tempId, 'stock_quantity', Number(e.target.value))}
                              placeholder="0" 
                              style={{ width: '100%', boxSizing: 'border-box', height: '28px', fontSize: '12px', fontWeight: 700, padding: '2px 8px' }}
                            />
                          </td>
                          <td style={{ textAlign: 'center', padding: '5px 4px' }}>
                            <button
                              type="button"
                              className="btn-icon text-danger"
                              onClick={() => handleRemoveRow(row.tempId)}
                              title="Remove row"
                              style={{ padding: '4px', cursor: 'pointer' }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Add row button (Right-aligned prominent big plus icon button) */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleAddEmptyRow}
                  title="Add row"
                  aria-label="Add row"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-primary)',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.22)';
                    e.currentTarget.style.filter = 'brightness(1.08)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.15)';
                    e.currentTarget.style.filter = 'none';
                  }}
                >
                  <Plus size={20} strokeWidth={2.8} />
                </button>
              </div>

            </div>

            {/* Action Buttons Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowVariantModal(false)}
                style={{ padding: '5px 14px', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleCreateBatchVariants} 
                disabled={savingVariant || variantRows.length === 0}
                style={{ 
                  padding: '5px 18px', 
                  fontSize: '12px', 
                  fontWeight: 700, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '5px' 
                }}
              >
                <Check size={14} />
                {savingVariant 
                  ? 'Saving...' 
                  : `Save ${variantRows.length} ${variantRows.length === 1 ? 'Variant' : 'Variants'}`}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* QUICK EDIT VARIANT & STOCK MODAL */}
      {editVariantModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', maxHeight: '92vh', overflowY: 'auto', padding: '24px', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Boxes size={20} style={{ color: 'var(--color-primary)' }} /> Edit Variant & Stock
              </h3>
              <button 
                type="button" 
                onClick={() => setEditVariantModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditVariant} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>SKU Code</label>
                  <input type="text" className="form-control" value={editSku} onChange={e => setEditSku(e.target.value)} required style={{ height: '38px', fontSize: '13px' }} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Barcode *</label>
                  <input type="text" className="form-control" value={editBarcode} onChange={e => setEditBarcode(e.target.value)} required style={{ height: '38px', fontSize: '13px', fontFamily: 'monospace', fontWeight: 600 }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Size</label>
                  <SizeCombobox value={editSize} onChange={setEditSize} placeholder="Select / Type size" />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Color</label>
                  <ColorCombobox value={editColor} onChange={setEditColor} placeholder="Select / Type" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Purchase / Cost Price (৳)</label>
                  <input type="number" step="0.01" className="form-control" value={editCostPrice} onChange={e => setEditCostPrice(Number(e.target.value))} style={{ height: '38px', fontSize: '13px' }} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Selling Price (৳) *</label>
                  <input type="number" step="0.01" className="form-control" value={editSellPrice} onChange={e => setEditSellPrice(Number(e.target.value))} required style={{ height: '38px', fontSize: '13px', fontWeight: 700 }} />
                </div>
              </div>

              {/* Stock Quantity Highlight Box */}
              <div style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#166534' }}>
                    📦 Current Stock Quantity (Units)
                  </label>
                  <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 600 }}>
                    Change manually anytime
                  </span>
                </div>
                <input 
                  type="number" 
                  className="form-control" 
                  value={editStockQty} 
                  onChange={e => setEditStockQty(Number(e.target.value))} 
                  required 
                  min="0"
                  style={{ height: '40px', fontSize: '15px', fontWeight: 800, color: '#166534', backgroundColor: '#ffffff', borderColor: '#4ade80' }} 
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                    Low Stock Alert Threshold
                  </label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={editMinStock} 
                    onChange={e => setEditMinStock(Number(e.target.value))} 
                    style={{ width: '80px', height: '32px', fontSize: '12px', textAlign: 'center' }} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditVariantModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingEditVariant} style={{ fontWeight: 700, padding: '8px 20px' }}>
                  {savingEditVariant ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
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

      {/* REUSABLE CLEAN STOCK ADJUSTMENT MODAL */}
      {adjustingStockVariant && (
        <StockAdjustmentModal
          variant={adjustingStockVariant}
          variantsList={activeVariants}
          onClose={() => setAdjustingStockVariant(null)}
          onSuccess={async () => {
            await loadData();
            onRefreshStats();
          }}
        />
      )}

      {/* POST-CREATION PRICE TAG PRINT MODAL */}
      {createdVariantsForPrint && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '540px', maxHeight: '92vh', overflowY: 'auto', padding: '22px', borderRadius: 'var(--radius-md)', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 800 }}>
                    ✓ Created Successfully
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {createdVariantsForPrint.variants.length} {createdVariantsForPrint.variants.length === 1 ? 'Variant' : 'Variants'} Added
                  </span>
                </div>
                <h3 style={{ margin: '6px 0 0 0', fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Print Price Tags — <span style={{ color: 'var(--color-primary)' }}>{createdVariantsForPrint.productName}</span>
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setCreatedVariantsForPrint(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', padding: '2px 6px' }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              Do you want to print the barcode price tags for newly created variants? All tags will print serially.
            </p>

            {/* Created Variants summary list */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', maxHeight: '180px', overflowY: 'auto', backgroundColor: '#f8fafc', padding: '6px', display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '14px' }}>
              {createdVariantsForPrint.variants.map((v, i) => (
                <div key={v.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '6px 10px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 800, color: '#334155', minWidth: '20px' }}>#{i + 1}</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{v.size}</span>
                    <span style={{ color: '#64748b' }}>•</span>
                    <span style={{ color: '#475569' }}>{v.color}</span>
                    <span style={{ color: '#64748b' }}>•</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#0f172a' }}>{v.barcode}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 800, color: '#059669' }}>৳{Number(v.selling_price).toFixed(0)}</span>
                    <span style={{ fontSize: '11px', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#64748b' }}>
                      Stock: {v.stock_quantity ?? 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Copies Mode Selection */}
            <div style={{ backgroundColor: '#f1f5f9', padding: '10px 12px', borderRadius: '6px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Quantity to Print:</span>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: createdVariantsForPrint.copiesMode === 'single' ? 700 : 500 }}>
                  <input
                    type="radio"
                    name="copiesMode"
                    checked={createdVariantsForPrint.copiesMode === 'single'}
                    onChange={() => setCreatedVariantsForPrint(prev => prev ? ({ ...prev, copiesMode: 'single' }) : null)}
                  />
                  1 Tag per Variant ({createdVariantsForPrint.variants.length} total)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: createdVariantsForPrint.copiesMode === 'stock' ? 700 : 500 }}>
                  <input
                    type="radio"
                    name="copiesMode"
                    checked={createdVariantsForPrint.copiesMode === 'stock'}
                    onChange={() => setCreatedVariantsForPrint(prev => prev ? ({ ...prev, copiesMode: 'stock' }) : null)}
                  />
                  Match Stock Quantity ({createdVariantsForPrint.variants.reduce((sum, v) => sum + Math.max(1, v.stock_quantity ?? 1), 0)} total)
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setCreatedVariantsForPrint(null)}
              >
                Skip / Done
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => {
                  const printItems = createdVariantsForPrint.variants.map(v => ({
                    variant: v,
                    productName: createdVariantsForPrint.productName,
                    copies: createdVariantsForPrint.copiesMode === 'stock' ? Math.max(1, v.stock_quantity ?? 1) : 1
                  }));
                  printVariantsBatchLabels(printItems);
                  setCreatedVariantsForPrint(null);
                  showToast('Sent price tags to printer!', 'success');
                }}
                style={{ fontWeight: 800, padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Printer size={16} />
                Print Price Tags ({createdVariantsForPrint.copiesMode === 'stock' 
                  ? createdVariantsForPrint.variants.reduce((sum, v) => sum + Math.max(1, v.stock_quantity ?? 1), 0)
                  : createdVariantsForPrint.variants.length})
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

