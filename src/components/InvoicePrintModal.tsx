import React, { useState } from 'react';
import { Printer, X, Sliders, RefreshCw } from 'lucide-react';

export interface InvoiceItem {
  id?: string;
  name: string;
  size?: string;
  color?: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface InvoiceData {
  invoiceId: string;
  saleDate: string;
  paymentMethod: string;
  customerPhone?: string;
  totalAmount: number;
  discountAmount: number;
  payableAmount: number;
  receivedAmount: number;
  dueAmount: number;
  changeAmount: number;
  paymentRows?: { method: string; amount: number }[];
  items: InvoiceItem[];
}

export interface InvoicePrintSettings {
  paperWidth: number; // in mm, default 58
  horizontalOffset: number; // in mm, e.g. 0 (positive = right, negative = left)
  verticalOffset: number; // in mm, e.g. 0
  fontScale: number; // in %, e.g. 100
  itemSpacing: number; // in mm, e.g. 0.6
  showStoreHeader: boolean;
  showInvoiceDetails: boolean;
  showCustomerPhone: boolean;
  showPaymentBreakdown: boolean;
  storeName: string;
}

const DEFAULT_INVOICE_SETTINGS: InvoicePrintSettings = {
  paperWidth: 58,
  horizontalOffset: 0,
  verticalOffset: 0,
  fontScale: 100,
  itemSpacing: 0.6,
  showStoreHeader: false,     // Minimal compact by default (no header)
  showInvoiceDetails: false,  // Minimal compact by default (no bulky invoice metadata)
  showCustomerPhone: false,
  showPaymentBreakdown: true,
  storeName: 'RAJMAHAL'
};

const getSavedInvoiceSettings = (): InvoicePrintSettings => {
  try {
    const raw = localStorage.getItem('pos_invoice_print_settings_58mm');
    if (raw) {
      return { ...DEFAULT_INVOICE_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Failed to load invoice print settings', e);
  }
  return DEFAULT_INVOICE_SETTINGS;
};

interface InvoicePrintModalProps {
  data: InvoiceData;
  onClose: () => void;
  onNewSale?: () => void;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({ data, onClose, onNewSale }) => {
  const [settings, setSettings] = useState<InvoicePrintSettings>(getSavedInvoiceSettings);
  const [showTuning, setShowTuning] = useState<boolean>(true);

  const updateSettings = (partial: Partial<InvoicePrintSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      localStorage.setItem('pos_invoice_print_settings_58mm', JSON.stringify(next));
      return next;
    });
  };

  const resetSettings = () => {
    setSettings(DEFAULT_INVOICE_SETTINGS);
    localStorage.setItem('pos_invoice_print_settings_58mm', JSON.stringify(DEFAULT_INVOICE_SETTINGS));
  };

  const scale = (settings.fontScale || 100) / 100;
  const baseFontSize = 11 * scale;
  const titleFontSize = 13 * scale;
  const totalFontSize = 13.5 * scale;
  const hOffset = settings.horizontalOffset || 0;
  const vOffset = settings.verticalOffset || 0;

  const handlePrint = () => {
    let iframe = document.getElementById('invoice-isolated-print-frame') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'invoice-isolated-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.width = '100vw';
      iframe.style.height = '100vh';
      iframe.style.zIndex = '-99999';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    const itemsHtml = data.items.map(item => `
      <div class="item-row" style="margin-bottom: ${settings.itemSpacing}mm;">
        <div class="item-name">
          ${item.name} ${item.size || item.color ? `(${[item.size, item.color].filter(Boolean).join('/')})` : ''}
        </div>
        <div class="item-details">
          <span>${item.quantity} × ৳${item.unitPrice.toFixed(0)}</span>
          <span class="item-price">৳${item.totalPrice.toFixed(0)}</span>
        </div>
      </div>
    `).join('');

    const paymentsHtml = (data.paymentRows || [])
      .filter(r => r.amount > 0)
      .map(r => `
        <div class="math-row" style="font-size: ${(baseFontSize * 0.9).toFixed(1)}px;">
          <span>Paid (${r.method}):</span>
          <span>৳${r.amount.toFixed(0)}</span>
        </div>
      `).join('');

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title> </title>
          <style>
            @page {
              size: ${settings.paperWidth}mm auto;
              margin: 0mm !important;
            }
            * {
              box-sizing: border-box !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: ${settings.paperWidth}mm !important;
              background: #ffffff !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace, sans-serif !important;
              color: #000000 !important;
              text-align: left !important;
              font-size: ${baseFontSize.toFixed(1)}px !important;
              line-height: 1.15 !important;
            }
            .receipt-container {
              width: ${settings.paperWidth}mm !important;
              max-width: ${settings.paperWidth}mm !important;
              margin: 0 !important;
              padding: 1.5mm 2.5mm !important;
              transform: translate(${hOffset}mm, ${vOffset}mm) !important;
              box-sizing: border-box !important;
            }
            .store-header {
              text-align: center !important;
              border-bottom: 1px dashed #000000 !important;
              padding-bottom: 1.5mm !important;
              margin-bottom: 1.5mm !important;
            }
            .store-title {
              font-size: ${titleFontSize.toFixed(1)}px !important;
              font-weight: 900 !important;
              text-transform: uppercase !important;
              letter-spacing: 0.5px !important;
              margin: 0 !important;
            }
            .store-sub {
              font-size: ${(baseFontSize * 0.75).toFixed(1)}px !important;
              font-weight: 700 !important;
              text-transform: uppercase !important;
              margin: 0.3mm 0 0 0 !important;
            }
            .meta-section {
              font-size: ${(baseFontSize * 0.85).toFixed(1)}px !important;
              border-bottom: 1px dashed #000000 !important;
              padding-bottom: 1.2mm !important;
              margin-bottom: 1.5mm !important;
            }
            .meta-row {
              display: flex !important;
              justify-content: space-between !important;
              margin-bottom: 0.3mm !important;
            }
            .items-section {
              border-bottom: 1px dashed #000000 !important;
              padding-bottom: 1.2mm !important;
              margin-bottom: 1.5mm !important;
            }
            .item-row {
              display: flex !important;
              flex-direction: column !important;
            }
            .item-name {
              font-weight: 800 !important;
              word-break: break-word !important;
              line-height: 1.15 !important;
            }
            .item-details {
              display: flex !important;
              justify-content: space-between !important;
              font-weight: 600 !important;
              font-size: ${(baseFontSize * 0.95).toFixed(1)}px !important;
            }
            .item-price {
              font-weight: 800 !important;
            }
            .math-section {
              display: flex !important;
              flex-direction: column !important;
              gap: 0.4mm !important;
            }
            .math-row {
              display: flex !important;
              justify-content: space-between !important;
              font-weight: 600 !important;
            }
            .total-row {
              display: flex !important;
              justify-content: space-between !important;
              font-size: ${totalFontSize.toFixed(1)}px !important;
              font-weight: 900 !important;
              border-top: 1px solid #000000 !important;
              padding-top: 0.8mm !important;
              margin-top: 0.5mm !important;
            }
            .footer-note {
              text-align: center !important;
              font-size: ${(baseFontSize * 0.75).toFixed(1)}px !important;
              font-weight: 700 !important;
              margin-top: 2mm !important;
              border-top: 1px dashed #000000 !important;
              padding-top: 1mm !important;
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            ${settings.showStoreHeader ? `
              <div class="store-header">
                <div class="store-title">${settings.storeName}</div>
                <div class="store-sub">Elegance — Mens Wear</div>
              </div>
            ` : ''}

            ${settings.showInvoiceDetails ? `
              <div class="meta-section">
                <div class="meta-row">
                  <span>INV: <strong>${data.invoiceId.toUpperCase().substring(0, 8)}</strong></span>
                  <span>${new Date(data.saleDate || Date.now()).toLocaleDateString()}</span>
                </div>
                ${settings.showCustomerPhone && data.customerPhone ? `
                  <div class="meta-row">
                    <span>Phone:</span>
                    <span><strong>${data.customerPhone}</strong></span>
                  </div>
                ` : ''}
              </div>
            ` : ''}

            <!-- Items -->
            <div class="items-section">
              ${itemsHtml}
            </div>

            <!-- Summary / Math -->
            <div class="math-section">
              ${data.discountAmount > 0 ? `
                <div class="math-row">
                  <span>Subtotal:</span>
                  <span>৳${data.totalAmount.toFixed(0)}</span>
                </div>
                <div class="math-row">
                  <span>Discount:</span>
                  <span>-৳${data.discountAmount.toFixed(0)}</span>
                </div>
              ` : ''}

              <div class="total-row">
                <span>TOTAL:</span>
                <span>৳${data.payableAmount.toFixed(0)}</span>
              </div>

              ${settings.showPaymentBreakdown ? `
                ${paymentsHtml || `
                  <div class="math-row">
                    <span>Paid (${data.paymentMethod}):</span>
                    <span>৳${data.receivedAmount.toFixed(0)}</span>
                  </div>
                `}
                ${data.dueAmount > 0 ? `
                  <div class="math-row" style="font-weight: 800;">
                    <span>DUE:</span>
                    <span>৳${data.dueAmount.toFixed(0)}</span>
                  </div>
                ` : ''}
                ${data.changeAmount > 0 ? `
                  <div class="math-row">
                    <span>Change:</span>
                    <span>৳${data.changeAmount.toFixed(0)}</span>
                  </div>
                ` : ''}
              ` : ''}
            </div>

            <div class="footer-note">
              Thank You! • Visit Again
            </div>
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 250);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      padding: '12px'
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: '680px',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'var(--radius-md)',
        padding: '16px',
        backgroundColor: '#ffffff',
        boxShadow: 'var(--shadow-xl)',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eef2f6', paddingBottom: '10px', marginBottom: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Receipt / Invoice Print
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              Optimized for <strong>Rongta 335A (58mm)</strong> • Compact Minimal Layout
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowTuning(!showTuning)}
              style={{
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 700,
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                backgroundColor: showTuning ? '#e0e7ff' : '#ffffff',
                color: showTuning ? '#3730a3' : '#475569',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Sliders size={12} /> {showTuning ? 'Hide Tuner' : 'Adjust Layout'}
            </button>
            <button 
              onClick={onClose} 
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Quick Tuning Toolbar */}
        {showTuning && (
          <div style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '6px',
            padding: '10px 12px',
            marginBottom: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #dbeafe', paddingBottom: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sliders size={13} /> 58mm Printer Alignment & Content Tuner
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>

              <button
                type="button"
                onClick={() => updateSettings({ showStoreHeader: false, showInvoiceDetails: false, fontScale: 100, itemSpacing: 0.5, horizontalOffset: 0, verticalOffset: 0 })}
                style={{ padding: '2px 8px', fontSize: '10px', fontWeight: 700, borderRadius: '4px', border: '1px solid #93c5fd', backgroundColor: '#ffffff', color: '#1d4ed8', cursor: 'pointer' }}
              >
                ⚡ Ultra-Compact
              </button>
              <button
                type="button"
                onClick={resetSettings}
                style={{ padding: '2px 6px', fontSize: '10px', fontWeight: 600, borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#64748b', cursor: 'pointer' }}
              >
                Reset
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
            {/* 1. Horizontal Shift */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                <span>Horizontal (L/R):</span>
                <span style={{ color: '#2563eb' }}>
                  {hOffset > 0 ? `+${hOffset}mm (Right)` : hOffset < 0 ? `${hOffset}mm (Left)` : '0mm (Center)'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button type="button" onClick={() => updateSettings({ horizontalOffset: Math.max(-8, hOffset - 1) })} style={{ width: '24px', height: '22px', fontSize: '11px', fontWeight: 800, border: '1px solid #cbd5e1', borderRadius: '3px', background: '#fff', cursor: 'pointer' }}>◀</button>
                <input 
                  type="range" 
                  min="-8" 
                  max="8" 
                  step="0.5" 
                  value={hOffset} 
                  onChange={e => updateSettings({ horizontalOffset: parseFloat(e.target.value) })}
                  style={{ flex: 1, accentColor: '#2563eb', cursor: 'pointer' }} 
                />
                <button type="button" onClick={() => updateSettings({ horizontalOffset: Math.min(8, hOffset + 1) })} style={{ width: '24px', height: '22px', fontSize: '11px', fontWeight: 800, border: '1px solid #cbd5e1', borderRadius: '3px', background: '#fff', cursor: 'pointer' }}>▶</button>
              </div>
            </div>

            {/* 2. Vertical Shift */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                <span>Vertical Shift:</span>
                <span style={{ color: '#2563eb' }}>{vOffset > 0 ? `+${vOffset}` : vOffset} mm</span>
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button type="button" onClick={() => updateSettings({ verticalOffset: Math.max(-10, vOffset - 1) })} style={{ width: '24px', height: '22px', fontSize: '11px', fontWeight: 800, border: '1px solid #cbd5e1', borderRadius: '3px', background: '#fff', cursor: 'pointer' }}>▲</button>
                <input 
                  type="range" 
                  min="-10" 
                  max="10" 
                  step="0.5" 
                  value={vOffset} 
                  onChange={e => updateSettings({ verticalOffset: parseFloat(e.target.value) })}
                  style={{ flex: 1, accentColor: '#2563eb', cursor: 'pointer' }} 
                />
                <button type="button" onClick={() => updateSettings({ verticalOffset: Math.min(10, vOffset + 1) })} style={{ width: '24px', height: '22px', fontSize: '11px', fontWeight: 800, border: '1px solid #cbd5e1', borderRadius: '3px', background: '#fff', cursor: 'pointer' }}>▼</button>
              </div>
            </div>

            {/* 3. Font Size Scale */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                <span>Font Size:</span>
                <span style={{ color: '#2563eb' }}>{settings.fontScale}%</span>
              </div>
              <input 
                type="range" 
                min="80" 
                max="130" 
                step="5" 
                value={settings.fontScale} 
                onChange={e => updateSettings({ fontScale: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer' }} 
              />
            </div>

            {/* 4. Item Gap */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                <span>Item Spacing:</span>
                <span style={{ color: '#2563eb' }}>{settings.itemSpacing} mm</span>
              </div>
              <input 
                type="range" 
                min="0.2" 
                max="2.0" 
                step="0.2" 
                value={settings.itemSpacing} 
                onChange={e => updateSettings({ itemSpacing: parseFloat(e.target.value) })}
                style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer' }} 
              />
            </div>
          </div>

          {/* Feature Toggles */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', borderTop: '1px dashed #bfdbfe', paddingTop: '6px', fontSize: '11px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={settings.showStoreHeader} 
                onChange={e => updateSettings({ showStoreHeader: e.target.checked })} 
                style={{ accentColor: '#2563eb' }}
              />
              <span>Store Header</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={settings.showInvoiceDetails} 
                onChange={e => updateSettings({ showInvoiceDetails: e.target.checked })} 
                style={{ accentColor: '#2563eb' }}
              />
              <span>Invoice # & Date</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={settings.showCustomerPhone} 
                onChange={e => updateSettings({ showCustomerPhone: e.target.checked })} 
                style={{ accentColor: '#2563eb' }}
              />
              <span>Customer Phone</span>
            </label>
          </div>
        </div>
      )}

        {/* Live Preview of 58mm Receipt */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          backgroundColor: '#f1f5f9',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)',
          padding: '16px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start'
        }}>
          {/* Simulated 58mm thermal paper roll */}
          <div style={{
            width: '240px', // Exact visual representation of 58mm paper
            backgroundColor: '#ffffff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            borderRadius: '4px',
            padding: '12px 10px',
            fontFamily: 'monospace, sans-serif',
            fontSize: `${baseFontSize}px`,
            lineHeight: 1.2,
            color: '#000000',
            transform: `translate(${hOffset * 2.8}px, ${vOffset * 2.8}px)`
          }}>
            {/* Store Header */}
            {settings.showStoreHeader && (
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #94a3b8', paddingBottom: '6px', marginBottom: '6px' }}>
                <div style={{ fontSize: `${titleFontSize}px`, fontWeight: 900, textTransform: 'uppercase' }}>{settings.storeName}</div>
                <div style={{ fontSize: `${baseFontSize * 0.75}px`, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Elegance — Mens Wear</div>
              </div>
            )}

            {/* Invoice Details */}
            {settings.showInvoiceDetails && (
              <div style={{ fontSize: `${baseFontSize * 0.85}px`, borderBottom: '1px dashed #94a3b8', paddingBottom: '6px', marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>INV: <strong>{data.invoiceId.toUpperCase().substring(0, 8)}</strong></span>
                  <span>{new Date(data.saleDate || Date.now()).toLocaleDateString()}</span>
                </div>
                {settings.showCustomerPhone && data.customerPhone && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                    <span>Phone:</span>
                    <span><strong>{data.customerPhone}</strong></span>
                  </div>
                )}
              </div>
            )}

            {/* Items List */}
            <div style={{ borderBottom: '1px dashed #94a3b8', paddingBottom: '6px', marginBottom: '6px' }}>
              {data.items.map((item, idx) => (
                <div key={idx} style={{ marginBottom: `${settings.itemSpacing * 3.5}px` }}>
                  <div style={{ fontWeight: 800, wordBreak: 'break-word' }}>
                    {item.name} {item.size || item.color ? `(${[item.size, item.color].filter(Boolean).join('/')})` : ''}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: `${baseFontSize * 0.95}px` }}>
                    <span>{item.quantity} × ৳{item.unitPrice.toFixed(0)}</span>
                    <span style={{ fontWeight: 800 }}>৳{item.totalPrice.toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Math & Total */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {data.discountAmount > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span>Subtotal:</span>
                    <span>৳{data.totalAmount.toFixed(0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#e11d48' }}>
                    <span>Discount:</span>
                    <span>-৳{data.discountAmount.toFixed(0)}</span>
                  </div>
                </>
              )}

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: `${totalFontSize}px`,
                fontWeight: 900,
                borderTop: '1px solid #000',
                paddingTop: '4px',
                marginTop: '2px'
              }}>
                <span>TOTAL:</span>
                <span>৳{data.payableAmount.toFixed(0)}</span>
              </div>

              {settings.showPaymentBreakdown && (
                <>
                  {(data.paymentRows || []).filter(r => r.amount > 0).map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: `${baseFontSize * 0.9}px`, color: '#334155' }}>
                      <span>Paid ({r.method}):</span>
                      <span>৳{r.amount.toFixed(0)}</span>
                    </div>
                  ))}
                  {(!data.paymentRows || data.paymentRows.length === 0) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: `${baseFontSize * 0.9}px`, color: '#334155' }}>
                      <span>Paid ({data.paymentMethod}):</span>
                      <span>৳{data.receivedAmount.toFixed(0)}</span>
                    </div>
                  )}
                  {data.dueAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#e11d48' }}>
                      <span>DUE:</span>
                      <span>৳{data.dueAmount.toFixed(0)}</span>
                    </div>
                  )}
                  {data.changeAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: 700 }}>
                      <span>Change:</span>
                      <span>৳{data.changeAmount.toFixed(0)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ textAlign: 'center', fontSize: `${baseFontSize * 0.75}px`, fontWeight: 700, color: '#64748b', marginTop: '8px', borderTop: '1px dashed #94a3b8', paddingTop: '4px' }}>
              Thank You! • Visit Again
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #eef2f6', paddingTop: '10px', marginTop: '10px' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            Close
          </button>
          {onNewSale && (
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onNewSale}>
              <RefreshCw size={14} /> New Sale
            </button>
          )}
          <button className="btn btn-primary" style={{ flex: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={handlePrint}>
            <Printer size={15} /> Print Receipt (58mm)
          </button>
        </div>
      </div>
    </div>
  );
};
