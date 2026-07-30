import { supabase } from './supabaseClient';
import type { Product, ProductVariant } from './store';

export const dbService = {
  // --- Products & Variants ---
  async getProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async saveProduct(product: Omit<Product, 'id'> & { id?: string }): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .upsert(product)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getVariants(): Promise<ProductVariant[]> {
    const { data, error } = await supabase
      .from('product_variants')
      .select('*, product:products(*)');
    if (error) throw error;
    return data || [];
  },

  async saveVariant(variant: Omit<ProductVariant, 'id'> & { id?: string }): Promise<ProductVariant> {
    const { data, error } = await supabase
      .from('product_variants')
      .upsert(variant)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteVariant(id: string): Promise<void> {
    const { error } = await supabase
      .from('product_variants')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // --- Suppliers ---
  async getSuppliers() {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async saveSupplier(supplier: any) {
    const { data, error } = await supabase
      .from('suppliers')
      .upsert(supplier)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // --- Purchases ---
  async getPurchases() {
    const { data, error } = await supabase
      .from('purchases')
      .select('*, supplier:suppliers(*)')
      .order('purchase_date', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async addPurchase(supplierId: string, items: { variantId: string; quantity: number; unitCost: number }[], invoiceNumber: string, shippingCost: number = 0) {
    const totalAmount = items.reduce((acc, item) => acc + (item.quantity * item.unitCost), 0) + shippingCost;

    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        supplier_id: supplierId,
        total_amount: totalAmount,
        shipping_cost: shippingCost,
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
  },

  // --- Sales ---
  async getSales() {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('sale_date', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getSaleItems(saleId: string) {
    const { data, error } = await supabase
      .from('sale_items')
      .select('*, variant:product_variants(*, product:products(*))')
      .eq('sale_id', saleId);
    if (error) throw error;
    return data || [];
  },

  async checkoutSale(cart: { variant: ProductVariant; quantity: number; customPrice?: number }[], discount: number, paymentMethod: string, receivedAmount: number, customerPhone: string = '') {
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
          total_price: item.quantity * itemPrice
        };
      });
      
      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;
      
      return sale.id;
    }
    throw new Error('Failed to checkout sale');
  },

  // --- Reports & Analytics ---
  async getDashboardStats() {
    const variants = await this.getVariants();
    const sales = await this.getSales();
    
    // Total Revenue
    const revenue = sales.reduce((acc: number, s: any) => acc + Number(s.payable_amount), 0);
    
    // Total profit (Difference between sale price and purchase cost)
    // We query sale items to get cost details
    const { data: saleItems, error } = await supabase
      .from('sale_items')
      .select('quantity, unit_price, variant_id');
      
    let profit = 0;
    if (!error && saleItems) {
      saleItems.forEach((si: any) => {
        const v = variants.find(x => x.id === si.variant_id);
        if (v) {
          profit += (si.quantity * (si.unit_price - v.purchase_price));
        }
      });
    }

    // Low Stock Alert Count
    const lowStockCount = variants.filter(v => v.stock_quantity <= v.min_stock_level).length;

    return {
      totalRevenue: revenue,
      totalProfit: profit,
      totalSalesCount: sales.length,
      lowStockAlerts: lowStockCount,
      recentSales: sales.slice(0, 5)
    };
  },

  // --- Users & Staff Management ---
  async getUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async updateUserRole(id: string, role: string) {
    const { data, error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteUser(id: string) {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getSaleItemsDetailed() {
    const { data, error } = await supabase
      .from('sale_items')
      .select('*, sale:sales(*)');
    if (error) throw error;
    return data || [];
  },

  async getStockLedger() {
    const { data, error } = await supabase
      .from('stock_ledger')
      .select('*, variant:product_variants(*, product:products(*))')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // --- Expenses ---
  async getExpenses() {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false });
    if (error) throw error;
    return data || [];
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
    return data;
  },

  async deleteExpense(id: string) {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};
