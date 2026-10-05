import { supabase } from './supabaseClient';
import type { Product, ProductVariant } from './store';

// High-speed In-Memory Cache with TTL
interface CacheStore {
  products?: { data: Product[]; timestamp: number };
  variants?: { data: ProductVariant[]; timestamp: number };
  suppliers?: { data: any[]; timestamp: number };
  purchases?: { data: any[]; timestamp: number };
  sales?: { data: any[]; timestamp: number };
  expenses?: { data: any[]; timestamp: number };
  users?: { data: any[]; timestamp: number };
  stock_ledger?: { data: any[]; timestamp: number };
  sale_items_detailed?: { data: any[]; timestamp: number };
}

const CACHE_TTL_MS = 60 * 1000; // 1 minute fresh cache
const cache: CacheStore = {};

export const clearPosCache = (keys?: (keyof CacheStore)[]) => {
  if (!keys) {
    Object.keys(cache).forEach((k) => delete cache[k as keyof CacheStore]);
  } else {
    keys.forEach((k) => delete cache[k]);
  }
};

export const dbService = {
  // Cache utility
  clearCache: clearPosCache,

  // --- Products & Variants ---
  async getProducts(forceRefresh = false): Promise<Product[]> {
    const now = Date.now();
    if (!forceRefresh && cache.products && (now - cache.products.timestamp < CACHE_TTL_MS)) {
      return cache.products.data;
    }
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const result = data || [];
    cache.products = { data: result, timestamp: now };
    return result;
  },

  async saveProduct(product: Omit<Product, 'id'> & { id?: string }): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .upsert(product)
      .select()
      .single();
    if (error) throw error;
    clearPosCache(['products', 'variants']);
    return data;
  },

  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    if (error) throw error;
    clearPosCache(['products', 'variants']);
  },

  async clearAllProducts(): Promise<void> {
    const { data: prods } = await supabase.from('products').select('id');
    if (prods && prods.length > 0) {
      const ids = prods.map(p => p.id);
      await supabase.from('product_variants').delete().in('product_id', ids);
      const { error } = await supabase.from('products').delete().in('id', ids);
      if (error) throw error;
    }
    clearPosCache(['products', 'variants', 'stock_ledger']);
  },

  async getVariants(forceRefresh = false): Promise<ProductVariant[]> {
    const now = Date.now();
    if (!forceRefresh && cache.variants && (now - cache.variants.timestamp < CACHE_TTL_MS)) {
      return cache.variants.data;
    }
    const { data, error } = await supabase
      .from('product_variants')
      .select('*, product:products(*)')
      .limit(50000);
    if (error) throw error;
    const result = (data || []).map(v => ({
      ...v,
      barcode: (v.barcode || '').trim().replace(/[^0-9a-zA-Z]/g, '')
    }));
    cache.variants = { data: result, timestamp: now };
    return result;
  },

  async saveVariant(variant: Omit<ProductVariant, 'id'> & { id?: string }): Promise<ProductVariant> {
    const payload = { ...variant };
    if (payload.barcode) {
      payload.barcode = payload.barcode.trim().replace(/[^0-9a-zA-Z]/g, '');
    } else if (!payload.id) {
      const existing = await this.getVariants(true);
      const usedBarcodes = new Set<string>();
      let maxNum = 0;
      for (const v of existing) {
        if (v.barcode) {
          const clean = v.barcode.trim().replace(/[^0-9a-zA-Z]/g, '');
          if (clean) {
            usedBarcodes.add(clean);
            usedBarcodes.add(clean.toLowerCase());
            const digits = clean.replace(/[^0-9]/g, '');
            if (digits && digits.length <= 12) {
              const parsed = parseInt(digits, 10);
              if (!isNaN(parsed) && parsed > maxNum) {
                maxNum = parsed;
              }
            }
          }
        }
      }
      let candidate = Math.max(1, maxNum + 1);
      while (usedBarcodes.has(String(candidate).padStart(6, '0')) || usedBarcodes.has(String(candidate))) {
        candidate++;
      }
      payload.barcode = String(candidate).padStart(6, '0');
    }

    const { data, error } = await supabase
      .from('product_variants')
      .upsert(payload)
      .select()
      .single();
    if (error) {
      const errMsg = error.message || '';
      if (error.code === '23505' || errMsg.includes('duplicate key') || errMsg.includes('unique constraint') || errMsg.includes('unique contsraint')) {
        if (errMsg.includes('barcode')) {
          throw new Error(`Barcode "${payload.barcode}" already exists in the inventory. Please generate or enter a different barcode.`);
        }
        if (errMsg.includes('sku')) {
          throw new Error(`SKU "${payload.sku}" already exists in the inventory. Please change the bundle or serial number.`);
        }
      }
      throw error;
    }

    if (!variant.id && data && data.stock_quantity > 0) {
      try {
        await supabase.from('stock_ledger').insert({
          variant_id: data.id,
          transaction_type: 'INITIAL_STOCK',
          quantity_change: data.stock_quantity,
          notes: 'Initial stock entered during variant creation'
        });
      } catch (ledgerErr) {
        console.warn('Failed to record initial stock ledger', ledgerErr);
      }
    }

    clearPosCache(['variants', 'stock_ledger']);
    return data;
  },

  async deleteVariant(id: string): Promise<void> {
    const { error } = await supabase
      .from('product_variants')
      .delete()
      .eq('id', id);
    if (error) throw error;
    clearPosCache(['variants']);
  },

  // --- Suppliers ---
  async getSuppliers(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cache.suppliers && (now - cache.suppliers.timestamp < CACHE_TTL_MS)) {
      return cache.suppliers.data;
    }
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    const result = data || [];
    cache.suppliers = { data: result, timestamp: now };
    return result;
  },

  async saveSupplier(supplier: any) {
    const { data, error } = await supabase
      .from('suppliers')
      .upsert(supplier)
      .select()
      .single();
    if (error) throw error;
    clearPosCache(['suppliers', 'purchases']);
    return data;
  },

  // --- Purchases ---
  async getPurchases(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cache.purchases && (now - cache.purchases.timestamp < CACHE_TTL_MS)) {
      return cache.purchases.data;
    }
    const { data, error } = await supabase
      .from('purchases')
      .select('*, supplier:suppliers(*)')
      .order('purchase_date', { ascending: false });
    if (error) throw error;
    const result = data || [];
    cache.purchases = { data: result, timestamp: now };
    return result;
  },

  async addPurchase(supplierId: string, items: { variantId: string; quantity: number; unitCost: number }[], invoiceNumber: string, shippingCost: number = 0) {
    const totalAmount = items.reduce((acc, item) => acc + (item.quantity * item.unitCost), 0) + (Number(shippingCost) || 0);

    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        supplier_id: supplierId,
        total_amount: totalAmount,
        invoice_number: invoiceNumber,
        status: 'RECEIVED'
      })
      .select()
      .single();

    if (purchaseError) throw purchaseError;

    if (purchase) {
      const purchaseItems = items.map(item => ({
        purchase_id: purchase.id,
        variant_id: item.variantId,
        quantity: item.quantity,
        unit_cost: item.unitCost
      }));
      const { error: itemsError } = await supabase
        .from('purchase_items')
        .insert(purchaseItems);
      
      if (itemsError) throw itemsError;
    }
    clearPosCache(['purchases', 'variants', 'stock_ledger']);
  },

  async adjustStock(variantId: string, newStockQuantity: number, reason: string = 'Manual stock adjustment') {
    // 1. Get existing variant stock
    const { data: variant, error: getErr } = await supabase
      .from('product_variants')
      .select('stock_quantity')
      .eq('id', variantId)
      .single();
    if (getErr) throw getErr;

    const currentStock = variant?.stock_quantity ?? 0;
    const delta = newStockQuantity - currentStock;

    // 2. Update variant stock
    const { data: updatedVariant, error: updateErr } = await supabase
      .from('product_variants')
      .update({ stock_quantity: newStockQuantity })
      .eq('id', variantId)
      .select('*, product:products(*)')
      .single();
    if (updateErr) throw updateErr;

    // 3. Record transaction in stock ledger
    const { error: ledgerErr } = await supabase
      .from('stock_ledger')
      .insert({
        variant_id: variantId,
        transaction_type: 'ADJUSTMENT',
        quantity_change: delta,
        notes: reason || `Manual adjustment from ${currentStock} to ${newStockQuantity}`
      });
    if (ledgerErr) {
      console.warn('Could not record stock ledger for adjustment:', ledgerErr);
    }

    clearPosCache(['variants', 'stock_ledger']);
    return updatedVariant;
  },

  // --- Sales ---
  async getSales(forceRefresh = false, limit?: number) {
    const now = Date.now();
    if (!forceRefresh && cache.sales && (now - cache.sales.timestamp < CACHE_TTL_MS)) {
      return limit ? cache.sales.data.slice(0, limit) : cache.sales.data;
    }
    let query = supabase
      .from('sales')
      .select('*')
      .order('sale_date', { ascending: false });

    if (limit) {
      query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }

    const { data, error } = await query;
    if (error) throw error;
    const result = data || [];
    cache.sales = { data: result, timestamp: now };
    return result;
  },

  async getSaleItems(saleId: string) {
    const { data, error } = await supabase
      .from('sale_items')
      .select('*, variant:product_variants(*, product:products(*))')
      .eq('sale_id', saleId);
    if (error) throw error;
    return data || [];
  },

  async checkoutSale(
    cart: {
      variant: ProductVariant;
      quantity: number;
      customPrice?: number;
      saleType?: 'SALE' | 'RENT';
      returnDate?: string | null;
    }[],
    discount: number,
    paymentMethod: string,
    receivedAmount: number,
    customerPhone: string = ''
  ) {
    const subtotal = cart.reduce((acc, item) => acc + (item.quantity * (item.customPrice || item.variant.selling_price)), 0);
    const payableAmount = Math.max(0, subtotal - discount);
    const changeAmount = receivedAmount > payableAmount ? receivedAmount - payableAmount : 0;
    const dueAmount = paymentMethod === 'DUE' ? payableAmount : (receivedAmount < payableAmount ? payableAmount - receivedAmount : 0);

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        total_amount: subtotal,
        discount_amount: discount,
        payable_amount: payableAmount,
        payment_method: paymentMethod,
        received_amount: receivedAmount,
        change_amount: changeAmount,
        customer_phone: customerPhone,
        due_amount: dueAmount
      })
      .select()
      .single();

    if (saleError) throw saleError;

    if (sale) {
      const saleItems = cart.map(item => {
        const itemPrice = item.customPrice || item.variant.selling_price;
        return {
          sale_id: sale.id,
          variant_id: item.variant.id,
          quantity: item.quantity,
          unit_price: itemPrice,
          total_price: item.quantity * itemPrice,
          sale_type: item.saleType || 'SALE',
          return_date: item.saleType === 'RENT' ? (item.returnDate || null) : null,
          is_returned: false
        };
      });
      
      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;
      
      clearPosCache(['sales', 'variants', 'sale_items_detailed', 'stock_ledger']);
      return sale.id;
    }
    throw new Error('Failed to checkout sale');
  },

  async deleteSale(saleId: string) {
    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', saleId);

    if (error) throw error;

    clearPosCache(['sales', 'variants', 'products', 'sale_items_detailed', 'stock_ledger']);
    return true;
  },

  async updateSale(
    saleId: string,
    saleData: {
      discount_amount: number;
      payment_method: string;
      received_amount: number;
      customer_phone?: string;
    },
    items: {
      id?: string;
      variant_id: string;
      quantity: number;
      unit_price: number;
      total_price: number;
      sale_type?: 'SALE' | 'RENT';
      return_date?: string | null;
      is_returned?: boolean;
    }[]
  ) {
    // 1. Calculate financials
    const subtotal = items.reduce((acc, it) => acc + (Number(it.quantity) * Number(it.unit_price)), 0);
    const payableAmount = Math.max(0, subtotal - (Number(saleData.discount_amount) || 0));
    const receivedAmount = Number(saleData.received_amount) || 0;
    const changeAmount = receivedAmount > payableAmount ? receivedAmount - payableAmount : 0;
    const dueAmount = saleData.payment_method === 'DUE' ? payableAmount : (receivedAmount < payableAmount ? payableAmount - receivedAmount : 0);

    // 2. Update sale header
    const { error: saleError } = await supabase
      .from('sales')
      .update({
        total_amount: subtotal,
        discount_amount: saleData.discount_amount || 0,
        payable_amount: payableAmount,
        payment_method: saleData.payment_method,
        received_amount: receivedAmount,
        change_amount: changeAmount,
        customer_phone: saleData.customer_phone || '',
        due_amount: dueAmount
      })
      .eq('id', saleId);

    if (saleError) throw saleError;

    // 3. Sync sale_items:
    const { data: existingItems, error: fetchErr } = await supabase
      .from('sale_items')
      .select('*')
      .eq('sale_id', saleId);

    if (fetchErr) throw fetchErr;

    const existingMap = new Map((existingItems || []).map(it => [it.id, it]));
    const currentItemIds = new Set(items.filter(it => it.id).map(it => it.id!));

    // A. Items to delete (removed from invoice)
    const itemsToDelete = (existingItems || []).filter(it => !currentItemIds.has(it.id));
    if (itemsToDelete.length > 0) {
      const deleteIds = itemsToDelete.map(it => it.id);
      const { error: delErr } = await supabase
        .from('sale_items')
        .delete()
        .in('id', deleteIds);
      if (delErr) throw delErr;
    }

    // B. Items to update (existed and still in invoice)
    const itemsToUpdate = items.filter(it => it.id && existingMap.has(it.id));
    for (const item of itemsToUpdate) {
      const existing = existingMap.get(item.id!)!;
      const changed = 
        existing.quantity !== item.quantity || 
        existing.unit_price !== item.unit_price || 
        existing.variant_id !== item.variant_id ||
        existing.sale_type !== (item.sale_type || 'SALE') ||
        existing.return_date !== (item.return_date || null) ||
        existing.is_returned !== (item.is_returned || false);

      if (changed) {
        const { error: upErr } = await supabase
          .from('sale_items')
          .update({
            variant_id: item.variant_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.quantity * item.unit_price,
            sale_type: item.sale_type || 'SALE',
            return_date: item.sale_type === 'RENT' ? (item.return_date || null) : null,
            is_returned: item.is_returned || false
          })
          .eq('id', item.id);
        if (upErr) throw upErr;
      }
    }

    // C. Items to insert (newly added to this invoice)
    const itemsToInsert = items.filter(it => !it.id);
    if (itemsToInsert.length > 0) {
      const newRows = itemsToInsert.map(it => ({
        sale_id: saleId,
        variant_id: it.variant_id,
        quantity: it.quantity,
        unit_price: it.unit_price,
        total_price: it.quantity * it.unit_price,
        sale_type: it.sale_type || 'SALE',
        return_date: it.sale_type === 'RENT' ? (it.return_date || null) : null,
        is_returned: false
      }));
      const { error: insErr } = await supabase
        .from('sale_items')
        .insert(newRows);
      if (insErr) throw insErr;
    }

    clearPosCache(['sales', 'variants', 'products', 'sale_items_detailed', 'stock_ledger']);
    return true;
  },

  // --- Ultra-Fast Low Stock Count for Badge (Does not pull all sales/items) ---
  async getLowStockCount(): Promise<number> {
    const variants = await this.getVariants();
    return variants.filter(v => v.stock_quantity <= (v.min_stock_level ?? 5)).length;
  },

  // --- Reports & Analytics (Parallelized & Cached) ---
  async getDashboardStats() {
    const [variants, sales, { data: saleItems }] = await Promise.all([
      this.getVariants(),
      this.getSales(),
      supabase.from('sale_items').select('quantity, unit_price, variant_id')
    ]);
    
    // Total Revenue
    const revenue = sales.reduce((acc: number, s: any) => acc + Number(s.payable_amount || 0), 0);
    
    // Total profit
    let profit = 0;
    if (saleItems) {
      const variantMap = new Map(variants.map(v => [v.id, v]));
      saleItems.forEach((si: any) => {
        const v = variantMap.get(si.variant_id);
        if (v) {
          profit += (si.quantity * (si.unit_price - v.purchase_price));
        }
      });
    }

    // Low Stock Alert Count
    const lowStockCount = variants.filter(v => v.stock_quantity <= (v.min_stock_level ?? 5)).length;

    return {
      totalRevenue: revenue,
      totalProfit: profit,
      totalSalesCount: sales.length,
      lowStockAlerts: lowStockCount,
      recentSales: sales.slice(0, 5)
    };
  },

  // --- Users & Staff Management ---
  async getUsers(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cache.users && (now - cache.users.timestamp < CACHE_TTL_MS)) {
      return cache.users.data;
    }
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const result = data || [];
    cache.users = { data: result, timestamp: now };
    return result;
  },

  async updateUserRole(id: string, role: string) {
    const { data, error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    clearPosCache(['users']);
    return data;
  },

  async deleteUser(id: string) {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);
    if (error) throw error;
    clearPosCache(['users']);
  },

  async getUserRole(userId: string, fallbackRole = 'cashier'): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      if (!error && data?.role) {
        return data.role;
      }
    } catch (e) {
      console.warn('Could not fetch role from users table:', e);
    }
    return fallbackRole;
  },

  async getSaleItemsDetailed(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cache.sale_items_detailed && (now - cache.sale_items_detailed.timestamp < CACHE_TTL_MS)) {
      return cache.sale_items_detailed.data;
    }
    const { data, error } = await supabase
      .from('sale_items')
      .select('*, sale:sales(*)');
    if (error) throw error;
    const result = data || [];
    cache.sale_items_detailed = { data: result, timestamp: now };
    return result;
  },

  async getStockLedger(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cache.stock_ledger && (now - cache.stock_ledger.timestamp < CACHE_TTL_MS)) {
      return cache.stock_ledger.data;
    }
    const { data, error } = await supabase
      .from('stock_ledger')
      .select('*, variant:product_variants(*, product:products(*))')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const result = data || [];
    cache.stock_ledger = { data: result, timestamp: now };
    return result;
  },

  // --- Expenses ---
  async getExpenses(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cache.expenses && (now - cache.expenses.timestamp < CACHE_TTL_MS)) {
      return cache.expenses.data;
    }
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false });
    if (error) throw error;
    const result = data || [];
    cache.expenses = { data: result, timestamp: now };
    return result;
  },

  async addExpense(category: string, amount: number, description: string) {
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        category,
        amount,
        description
      })
      .select()
      .single();
    if (error) throw error;
    clearPosCache(['expenses']);
    return data;
  },

  async deleteExpense(id: string) {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);
    if (error) throw error;
    clearPosCache(['expenses']);
  }
};
