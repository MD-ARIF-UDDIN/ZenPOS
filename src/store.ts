import { create } from 'zustand';

export interface Product {
  id: string;
  name: string;
  category: string;
  brand?: string;
  description?: string;
  rent_price?: number | null;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  barcode: string;
  size: string;
  color: string;
  purchase_price: number;
  selling_price: number;
  rent_price?: number | null;
  stock_quantity: number;
  min_stock_level: number;
  product?: Product; // joined
}

export interface CartItem {
  variant: ProductVariant;
  quantity: number;
  discount: number; // Flat discount per item
  customPrice?: number; // Custom inputted price
  saleType?: 'SALE' | 'RENT' | 'RETURN';
  returnDate?: string | null;
}

interface POSState {
  cart: CartItem[];
  discount: number; // Global flat discount
  paymentMethod: 'CASH' | 'CARD' | 'MOBILE_PAY';
  receivedAmount: number;
  addToCart: (variant: ProductVariant, saleType?: 'SALE' | 'RENT' | 'RETURN', customPrice?: number, returnDate?: string | null) => void;
  removeFromCart: (variantId: string, saleType?: 'SALE' | 'RENT' | 'RETURN') => void;
  updateCartQty: (variantId: string, quantity: number, saleType?: 'SALE' | 'RENT' | 'RETURN') => void;
  updateCartPrice: (variantId: string, price: number, saleType?: 'SALE' | 'RENT' | 'RETURN') => void;
  updateCartReturnDate: (variantId: string, returnDate: string | null, saleType?: 'SALE' | 'RENT' | 'RETURN') => void;
  updateCartSaleType: (variantId: string, currentSaleType: 'SALE' | 'RENT' | 'RETURN', newSaleType: 'SALE' | 'RENT' | 'RETURN') => void;
  clearCart: () => void;
  setDiscount: (discount: number) => void;
  setPaymentMethod: (method: 'CASH' | 'CARD' | 'MOBILE_PAY') => void;
  setReceivedAmount: (amount: number) => void;
}

export const usePOSStore = create<POSState>((set) => ({
  cart: [],
  discount: 0,
  paymentMethod: 'CASH',
  receivedAmount: 0,

  addToCart: (variant, saleType = 'SALE', customPrice, returnDate = null) => set((state) => {
    const defaultPrice = saleType === 'RENT' 
      ? Number(variant.rent_price ?? variant.product?.rent_price ?? 0)
      : variant.selling_price;
    const finalPrice = customPrice !== undefined ? customPrice : defaultPrice;

    const existingIndex = state.cart.findIndex(
      item => item.variant.id === variant.id && (item.saleType || 'SALE') === saleType
    );

    if (existingIndex > -1) {
      const updatedCart = [...state.cart];
      updatedCart[existingIndex].quantity += 1;
      if (returnDate) {
        updatedCart[existingIndex].returnDate = returnDate;
      }
      return { cart: updatedCart };
    }

    return {
      cart: [
        ...state.cart,
        {
          variant,
          quantity: 1,
          discount: 0,
          customPrice: finalPrice,
          saleType,
          returnDate: saleType === 'RENT' ? returnDate : null
        }
      ]
    };
  }),

  removeFromCart: (variantId, saleType) => set((state) => ({
    cart: state.cart.filter(item => 
      !(item.variant.id === variantId && (!saleType || (item.saleType || 'SALE') === saleType))
    )
  })),

  updateCartQty: (variantId, quantity, saleType) => set((state) => ({
    cart: state.cart.map(item => 
      (item.variant.id === variantId && (!saleType || (item.saleType || 'SALE') === saleType))
        ? { ...item, quantity: Math.max(1, quantity) } 
        : item
    )
  })),

  updateCartPrice: (variantId, price, saleType) => set((state) => ({
    cart: state.cart.map(item =>
      (item.variant.id === variantId && (!saleType || (item.saleType || 'SALE') === saleType))
        ? { ...item, customPrice: Math.max(0, price) }
        : item
    )
  })),

  updateCartReturnDate: (variantId, returnDate, saleType = 'RENT') => set((state) => ({
    cart: state.cart.map(item =>
      (item.variant.id === variantId && (item.saleType || 'SALE') === saleType)
        ? { ...item, returnDate }
        : item
    )
  })),

  updateCartSaleType: (variantId, currentSaleType, newSaleType) => set((state) => ({
    cart: state.cart.map(item => {
      if (item.variant.id === variantId && (item.saleType || 'SALE') === currentSaleType) {
        const defaultPrice = newSaleType === 'RENT'
          ? (item.variant.rent_price || item.variant.product?.rent_price || item.variant.selling_price)
          : item.variant.selling_price;
        return {
          ...item,
          saleType: newSaleType,
          customPrice: defaultPrice,
          returnDate: newSaleType === 'RENT' ? item.returnDate : null
        };
      }
      return item;
    })
  })),

  clearCart: () => set({ cart: [], discount: 0, receivedAmount: 0, paymentMethod: 'CASH' }),
  setDiscount: (discount) => set({ discount: Math.max(0, discount) }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  setReceivedAmount: (receivedAmount) => set({ receivedAmount }),
}));

interface ToastInfo {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface ModalInfo {
  title: string;
  message: string;
  type: 'alert' | 'confirm';
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface NotificationState {
  toasts: ToastInfo[];
  modal: ModalInfo | null;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  removeToast: (id: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => void;
  showAlert: (title: string, message: string) => void;
  closeModal: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  toasts: [],
  modal: null,
  showToast: (message, type = 'success') => set((state) => {
    const id = Math.random().toString(36).substring(2, 9);
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) }));
    }, 4000);
    return { toasts: [...state.toasts, { id, message, type }] };
  }),
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter(t => t.id !== id)
  })),
  showConfirm: (title, message, onConfirm, onCancel) => set({
    modal: { title, message, type: 'confirm', onConfirm, onCancel }
  }),
  showAlert: (title, message) => set({
    modal: { title, message, type: 'alert' }
  }),
  closeModal: () => set({ modal: null })
}));
