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
}

interface POSState {
  cart: CartItem[];
  discount: number; // Global flat discount
  paymentMethod: 'CASH' | 'CARD' | 'MOBILE_PAY';
  receivedAmount: number;
  addToCart: (variant: ProductVariant) => void;
  removeFromCart: (variantId: string) => void;
  updateCartQty: (variantId: string, quantity: number) => void;
  updateCartPrice: (variantId: string, price: number) => void;
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

  addToCart: (variant) => set((state) => {
    const existingIndex = state.cart.findIndex(item => item.variant.id === variant.id);
    if (existingIndex > -1) {
      const updatedCart = [...state.cart];
      updatedCart[existingIndex].quantity += 1;
      return { cart: updatedCart };
    }
    return { cart: [...state.cart, { variant, quantity: 1, discount: 0, customPrice: variant.selling_price }] };
  }),

  removeFromCart: (variantId) => set((state) => ({
    cart: state.cart.filter(item => item.variant.id !== variantId)
  })),

  updateCartQty: (variantId, quantity) => set((state) => ({
    cart: state.cart.map(item => 
      item.variant.id === variantId 
        ? { ...item, quantity: Math.max(1, quantity) } 
        : item
    )
  })),

  updateCartPrice: (variantId, price) => set((state) => ({
    cart: state.cart.map(item =>
      item.variant.id === variantId
        ? { ...item, customPrice: Math.max(0, price) }
        : item
    )
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
