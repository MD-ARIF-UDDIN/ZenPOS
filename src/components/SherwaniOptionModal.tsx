import React, { useState } from 'react';
import type { ProductVariant } from '../store';
import { X, ShoppingBag, Calendar, Check, Clock } from 'lucide-react';

interface SherwaniOptionModalProps {
  variant: ProductVariant;
  onConfirm: (saleType: 'SALE' | 'RENT', price: number, returnDate?: string | null) => void;
  onClose: () => void;
}

export const SherwaniOptionModal: React.FC<SherwaniOptionModalProps> = ({
  variant,
  onConfirm,
  onClose,
}) => {
  const defaultRentPrice = (variant.rent_price !== undefined && variant.rent_price !== null) 
    ? Number(variant.rent_price) 
    : (variant.product?.rent_price !== undefined && variant.product?.rent_price !== null ? Number(variant.product.rent_price) : 0);
  
  // Default return date to 3 days in the future (YYYY-MM-DD)
  const getDefaultReturnDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  };

  const [selectedType, setSelectedType] = useState<'SALE' | 'RENT'>('SALE');
  const [salePrice, setSalePrice] = useState<number>(variant.selling_price || 0);
  const [rentPrice, setRentPrice] = useState<number>(defaultRentPrice || 0);
  const [returnDate, setReturnDate] = useState<string>(getDefaultReturnDate());

  const handleConfirm = () => {
    if (selectedType === 'SALE') {
      onConfirm('SALE', salePrice, null);
    } else {
      onConfirm('RENT', rentPrice, returnDate);
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
        backgroundColor: 'rgba(11, 37, 69, 0.5)',
        backdropFilter: 'blur(3px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'Enter') handleConfirm();
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '460px',
          boxShadow: 'var(--shadow-lg)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          animation: 'fadeIn 0.15s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--color-primary)' }}>
              Rent or Direct Sale Option
            </h3>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {variant.product?.name} ({[variant.size, variant.color].filter(Boolean).join(' / ')})
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            style={{ borderRadius: '50%', width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body Options */}
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Radio / Card Selectors */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            
            {/* Direct Sale Card */}
            <div
              onClick={() => setSelectedType('SALE')}
              style={{
                border: `2px solid ${selectedType === 'SALE' ? 'var(--color-primary)' : 'var(--border-color)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                cursor: 'pointer',
                backgroundColor: selectedType === 'SALE' ? '#f0f4f9' : '#ffffff',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                position: 'relative',
              }}
            >
              {selectedType === 'SALE' && (
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    backgroundColor: 'var(--color-primary)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Check size={11} />
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary)' }}>
                <ShoppingBag size={18} />
                <span style={{ fontWeight: 800, fontSize: '13.5px' }}>Direct Sale</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Permanent purchase
              </div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>
                ৳{salePrice.toFixed(2)}
              </div>
            </div>

            {/* Rent Card */}
            <div
              onClick={() => setSelectedType('RENT')}
              style={{
                border: `2px solid ${selectedType === 'RENT' ? '#7c3aed' : 'var(--border-color)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                cursor: 'pointer',
                backgroundColor: selectedType === 'RENT' ? '#f5f3ff' : '#ffffff',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                position: 'relative',
              }}
            >
              {selectedType === 'RENT' && (
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    backgroundColor: '#7c3aed',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Check size={11} />
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#7c3aed' }}>
                <Clock size={18} />
                <span style={{ fontWeight: 800, fontSize: '13.5px' }}>Rent / ভাড়া</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Temporary rental
              </div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#7c3aed', marginTop: '4px' }}>
                ৳{rentPrice.toFixed(2)}
              </div>
            </div>

          </div>

          {/* Conditional Input Fields */}
          {selectedType === 'SALE' ? (
            <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Selling Price (৳)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-control"
                value={salePrice}
                onChange={(e) => setSalePrice(Math.max(0, parseFloat(e.target.value) || 0))}
                style={{ height: '34px', fontSize: '13px', fontWeight: 700 }}
                autoFocus
              />
            </div>
          ) : (
            <div style={{ padding: '12px', backgroundColor: '#faf5ff', borderRadius: 'var(--radius-md)', border: '1px solid #e9d5ff', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#6b21a8', marginBottom: '4px' }}>
                  Rent Price (৳)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  value={rentPrice}
                  onChange={(e) => setRentPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                  style={{ height: '34px', fontSize: '13px', fontWeight: 700 }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', fontWeight: 600, color: '#6b21a8', marginBottom: '4px' }}>
                  <Calendar size={13} /> Return Date (প্রত্যাশিত ফেরত তারিখ)
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  style={{ height: '34px', fontSize: '13px', fontWeight: 600 }}
                  required
                />
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '6px 14px' }}>
            Cancel
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleConfirm}
            style={{
              padding: '6px 20px',
              fontWeight: 700,
              backgroundColor: selectedType === 'RENT' ? '#7c3aed' : 'var(--color-primary)',
              borderColor: selectedType === 'RENT' ? '#7c3aed' : 'var(--color-primary)',
            }}
          >
            Add {selectedType === 'RENT' ? 'Rent' : 'Sale'} to Cart
          </button>
        </div>
      </div>
    </div>
  );
};
