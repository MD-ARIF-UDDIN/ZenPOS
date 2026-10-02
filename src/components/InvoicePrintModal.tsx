import React, { useState } from 'react';
import { Printer, X, Sliders, RefreshCw, Store } from 'lucide-react';

export interface InvoiceItem {
  id?: string;
  name: string;
  code?: string;
  barcode?: string;
  sku?: string;
  size?: string;
  color?: string;
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
  paperWidth: number; // physical paper width in mm, default 58
  printableWidth: number; // actual printhead width in mm, default 52 (enlarged across paper)
  rightMargin: number; // safe right inset in mm, default 1
  horizontalOffset: number; // in mm, e.g. 0 (positive = right, negative = left)
  verticalOffset: number; // in mm, e.g. 0
  fontScale: number; // in %, e.g. 115 (larger text)
  itemSpacing: number; // in mm, e.g. 0.5
  showStoreHeader: boolean;
  storeName: string;
  storeSubtitle: string;
  storeAddress: string;
  storePhone: string;
  showInvoiceDetails: boolean;
  showCustomerPhone: boolean;
  showProductCode: boolean;
  showPaymentBreakdown: boolean;
  footerText: string;
}

const DEFAULT_INVOICE_SETTINGS: InvoicePrintSettings = {
  paperWidth: 58,
  printableWidth: 52,
  rightMargin: 1,
  horizontalOffset: 0,
  verticalOffset: 0,
  fontScale: 115,
  itemSpacing: 0.5,
  showStoreHeader: true,
  storeName: 'RAJMAHAL',
  storeSubtitle: 'Elegance — Mens Wear',
  storeAddress: '',
  storePhone: '',
  showInvoiceDetails: true,
  showCustomerPhone: true,
  showProductCode: true,
  showPaymentBreakdown: true,
  footerText: 'Thank You! • Visit Again'
};

const getSavedInvoiceSettings = (): InvoicePrintSettings => {
  try {
    const raw = localStorage.getItem('pos_invoice_print_settings_58mm_v5');
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
  const [activeTab, setActiveTab] = useState<'adjust' | 'showroom'>('adjust');

  const updateSettings = (partial: Partial<InvoicePrintSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      localStorage.setItem('pos_invoice_print_settings_58mm_v5', JSON.stringify(next));
      return next;
    });
  };

  const resetSettings = () => {
    setSettings(DEFAULT_INVOICE_SETTINGS);
    localStorage.setItem('pos_invoice_print_settings_58mm_v5', JSON.stringify(DEFAULT_INVOICE_SETTINGS));
  };

  const scale = (settings.fontScale || 115) / 100;
  const baseFontSize = 11.5 * scale;
  const titleFontSize = 15 * scale;
  const totalFontSize = 14.5 * scale;
  const hOffset = settings.horizontalOffset || 0;
  const vOffset = settings.verticalOffset || 0;
  const printableWidth = settings.printableWidth || 52;
  const rightMargin = settings.rightMargin !== undefined ? settings.rightMargin : 1;

  const handlePrint = () => {
    let iframe = document.getElementById('invoice-isolated-print-frame') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'invoice-isolated-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.width = '58mm';
      iframe.style.height = '100px';
      iframe.style.zIndex = '-99999';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    const itemsHtml = data.items.map(item => {
      const productCode = item.sku || item.code;
      return `
        <div class="item-row" style="margin-bottom: ${settings.itemSpacing}mm;">
          <div class="item-name">
            ${item.name} ${item.size || item.color ? `(${[item.size, item.color].filter(Boolean).join('/')})` : ''}
          </div>
          ${settings.showProductCode && productCode ? `
            <div class="item-code">
              Code: ${productCode}
            </div>
          ` : ''}
          <div class="item-details">
            <span>${item.quantity} × ৳${item.unitPrice.toFixed(0)}</span>
            <span class="item-price">৳${item.totalPrice.toFixed(0)}</span>
          </div>
        </div>
      `;
    }).join('');

    const paymentsHtml = (data.paymentRows || [])
      .filter(r => r.amount > 0)
      .map(r => `
        <div class="math-row" style="font-size: ${(baseFontSize * 0.95).toFixed(1)}px;">
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
              margin: 0 !important;
            }
            * {
              box-sizing: border-box !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              width: ${settings.paperWidth}mm !important;
              max-width: ${settings.paperWidth}mm !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
              color: #000000 !important;
              text-align: left !important;
              font-size: ${baseFontSize.toFixed(1)}px !important;
              font-weight: 700 !important;
              line-height: 1.2 !important;
              -webkit-font-smoothing: antialiased !important;
              text-rendering: optimizeLegibility !important;
              overflow: visible !important;
            }
            .receipt-container {
              width: ${printableWidth}mm !important;
              max-width: ${printableWidth}mm !important;
              margin: 0 !important;
              padding: 1.5mm ${rightMargin}mm 2mm 1.2mm !important;
              transform: translate(${hOffset}mm, ${vOffset}mm) !important;
              box-sizing: border-box !important;
              page-break-after: avoid !important;
              page-break-before: avoid !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              break-after: avoid !important;
            }
            .store-header {
              text-align: center !important;
              border-bottom: 1.5px dashed #000000 !important;
              padding-bottom: 1.5mm !important;
              margin-bottom: 1.5mm !important;
            }
            .store-title {
              font-size: ${titleFontSize.toFixed(1)}px !important;
              font-weight: 900 !important;
              text-transform: uppercase !important;
              letter-spacing: 0.5px !important;
              margin: 0 !important;
              line-height: 1.1 !important;
              color: #000000 !important;
            }
            .store-sub {
              font-size: ${(baseFontSize * 0.85).toFixed(1)}px !important;
              font-weight: 800 !important;
              text-transform: uppercase !important;
              margin: 0.3mm 0 0 0 !important;
              color: #000000 !important;
            }
            .store-contact {
              font-size: ${(baseFontSize * 0.8).toFixed(1)}px !important;
              font-weight: 700 !important;
              margin: 0.3mm 0 0 0 !important;
              color: #000000 !important;
            }
            .meta-section {
              font-size: ${(baseFontSize * 0.9).toFixed(1)}px !important;
              font-weight: 700 !important;
              border-bottom: 1.5px dashed #000000 !important;
              padding-bottom: 1.2mm !important;
              margin-bottom: 1.5mm !important;
              color: #000000 !important;
            }
            .meta-row {
              display: flex !important;
              justify-content: space-between !important;
              margin-bottom: 0.4mm !important;
            }
            .items-section {
              border-bottom: 1.5px dashed #000000 !important;
              padding-bottom: 1.2mm !important;
              margin-bottom: 1.5mm !important;
            }
            .item-row {
              display: flex !important;
              flex-direction: column !important;
            }
            .item-name {
              font-weight: 900 !important;
              word-break: break-word !important;
              line-height: 1.2 !important;
              color: #000000 !important;
            }
            .item-code {
              font-size: ${(baseFontSize * 0.82).toFixed(1)}px !important;
              font-weight: 800 !important;
              color: #000000 !important;
              letter-spacing: 0.2px !important;
              line-height: 1.15 !important;
            }
            .item-details {
              display: flex !important;
              justify-content: space-between !important;
              font-weight: 800 !important;
              font-size: ${(baseFontSize * 0.95).toFixed(1)}px !important;
              color: #000000 !important;
            }
            .item-price {
              font-weight: 900 !important;
              color: #000000 !important;
            }
            .math-section {
              display: flex !important;
              flex-direction: column !important;
              gap: 0.5mm !important;
            }
            .math-row {
              display: flex !important;
              justify-content: space-between !important;
              font-weight: 700 !important;
              color: #000000 !important;
            }
            .total-row {
              display: flex !important;
              justify-content: space-between !important;
              font-size: ${totalFontSize.toFixed(1)}px !important;
              font-weight: 900 !important;
              border-top: 1.5px solid #000000 !important;
              padding-top: 1mm !important;
              margin-top: 0.5mm !important;
              color: #000000 !important;
            }
            .footer-note {
              text-align: center !important;
              font-size: ${(baseFontSize * 0.8).toFixed(1)}px !important;
              font-weight: 800 !important;
              margin-top: 2mm !important;
              border-top: 1.5px dashed #000000 !important;
              padding-top: 1mm !important;
              color: #000000 !important;
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            ${settings.showStoreHeader ? `
              <div class="store-header">
                <div class="store-title">${settings.storeName || 'RAJMAHAL'}</div>
                ${settings.storeSubtitle ? `<div class="store-sub">${settings.storeSubtitle}</div>` : ''}
                ${settings.storeAddress ? `<div class="store-contact">${settings.storeAddress}</div>` : ''}
                ${settings.storePhone ? `<div class="store-contact">Phone: ${settings.storePhone}</div>` : ''}
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
                    <span>Customer:</span>
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
                  <div class="math-row" style="font-weight: 900;">
                    <span>DUE:</span>
                    <span>৳${data.dueAmount.toFixed(0)}</span>
                  </div>
                ` : ''}
                ${data.changeAmount > 0 ? `
                  <div class="math-row" style="font-weight: 800;">
                    <span>Change:</span>
                    <span>৳${data.changeAmount.toFixed(0)}</span>
                  </div>
                ` : ''}
              ` : ''}
            </div>

            <div class="footer-note">
              ${settings.footerText || 'Thank You! • Visit Again'}
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
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      padding: '12px'
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: '720px',
        maxHeight: '95vh',
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
              Sales Invoice Print (58mm)
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              Enlarged & Sharp High-Contrast Thermal Print • <strong>Rongta 335A</strong>
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowTuning(!showTuning)}
              style={{
                padding: '4px 10px',
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
              <Sliders size={12} /> {showTuning ? 'Hide Settings' : 'Settings & Alignment'}
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
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            padding: '10px 12px',
            marginBottom: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {/* Tuner Navigation Tabs */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('adjust')}
                  style={{
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: activeTab === 'adjust' ? '#2563eb' : '#cbd5e1',
                    backgroundColor: activeTab === 'adjust' ? '#eff6ff' : '#ffffff',
                    color: activeTab === 'adjust' ? '#1d4ed8' : '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  <Sliders size={11} style={{ display: 'inline', marginRight: '3px' }} /> Alignment & Width
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('showroom')}
                  style={{
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: activeTab === 'showroom' ? '#2563eb' : '#cbd5e1',
                    backgroundColor: activeTab === 'showroom' ? '#eff6ff' : '#ffffff',
                    color: activeTab === 'showroom' ? '#1d4ed8' : '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  <Store size={11} style={{ display: 'inline', marginRight: '3px' }} /> Showroom Info
                </button>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={resetSettings}
                  style={{ padding: '2px 6px', fontSize: '10px', fontWeight: 600, borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#64748b', cursor: 'pointer' }}
                >
                  Reset Defaults
                </button>
              </div>
            </div>

            {activeTab === 'adjust' ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '10px' }}>
                  {/* 1. Horizontal Shift */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                      <span>Horizontal (L/R):</span>
                      <span style={{ color: '#2563eb' }}>
                        {hOffset > 0 ? `+${hOffset}mm` : hOffset < 0 ? `${hOffset}mm` : '0mm'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <button type="button" onClick={() => updateSettings({ horizontalOffset: Math.max(-10, hOffset - 1) })} style={{ width: '24px', height: '22px', fontSize: '11px', fontWeight: 800, border: '1px solid #cbd5e1', borderRadius: '3px', background: '#fff', cursor: 'pointer' }}>◀</button>
                      <input 
                        type="range" 
                        min="-10" 
                        max="10" 
                        step="0.5" 
                        value={hOffset} 
                        onChange={e => updateSettings({ horizontalOffset: parseFloat(e.target.value) })}
                        style={{ flex: 1, accentColor: '#2563eb', cursor: 'pointer' }} 
                      />
                      <button type="button" onClick={() => updateSettings({ horizontalOffset: Math.min(10, hOffset + 1) })} style={{ width: '24px', height: '22px', fontSize: '11px', fontWeight: 800, border: '1px solid #cbd5e1', borderRadius: '3px', background: '#fff', cursor: 'pointer' }}>▶</button>
                    </div>
                  </div>

                  {/* 2. Printable Width (Enlarges full width) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                      <span>Printable Width:</span>
                      <span style={{ color: '#2563eb' }}>{printableWidth} mm</span>
                    </div>
                    <input 
                      type="range" 
                      min="44" 
                      max="58" 
                      step="1" 
                      value={printableWidth} 
                      onChange={e => updateSettings({ printableWidth: parseInt(e.target.value) })}
                      style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer' }} 
                    />
                  </div>

                  {/* 3. Right Safe Margin Inset */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                      <span>Right Margin:</span>
                      <span style={{ color: '#2563eb' }}>{rightMargin} mm</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="5" 
                      step="0.5" 
                      value={rightMargin} 
                      onChange={e => updateSettings({ rightMargin: parseFloat(e.target.value) })}
                      style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer' }} 
                    />
                  </div>

                  {/* 4. Font Size Scale (Enlarged) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                      <span>Font Size:</span>
                      <span style={{ color: '#2563eb' }}>{settings.fontScale}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="80" 
                      max="150" 
                      step="5" 
                      value={settings.fontScale} 
                      onChange={e => updateSettings({ fontScale: parseInt(e.target.value) })}
                      style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer' }} 
                    />
                  </div>
                </div>

                {/* Feature Toggles */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', borderTop: '1px dashed #cbd5e1', paddingTop: '6px', fontSize: '11px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 600 }}>
                    <input 
                      type="checkbox" 
                      checked={settings.showStoreHeader} 
                      onChange={e => updateSettings({ showStoreHeader: e.target.checked })} 
                      style={{ accentColor: '#2563eb' }}
                    />
                    <span>Showroom Header</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 600 }}>
                    <input 
                      type="checkbox" 
                      checked={settings.showInvoiceDetails} 
                      onChange={e => updateSettings({ showInvoiceDetails: e.target.checked })} 
                      style={{ accentColor: '#2563eb' }}
                    />
                    <span>Invoice # & Date</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 600 }}>
                    <input 
                      type="checkbox" 
                      checked={settings.showCustomerPhone} 
                      onChange={e => updateSettings({ showCustomerPhone: e.target.checked })} 
                      style={{ accentColor: '#2563eb' }}
                    />
                    <span>Customer Phone</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 600 }}>
                    <input 
                      type="checkbox" 
                      checked={settings.showProductCode} 
                      onChange={e => updateSettings({ showProductCode: e.target.checked })} 
                      style={{ accentColor: '#2563eb' }}
                    />
                    <span>Product Code (SKU)</span>
                  </label>
                </div>
              </>
            ) : (
              /* Showroom Info Configuration */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                    Showroom / Store Name:
                  </label>
                  <input
                    type="text"
                    value={settings.storeName}
                    onChange={e => updateSettings({ storeName: e.target.value })}
                    placeholder="e.g. RAJMAHAL"
                    style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                    Subtitle / Tagline:
                  </label>
                  <input
                    type="text"
                    value={settings.storeSubtitle}
                    onChange={e => updateSettings({ storeSubtitle: e.target.value })}
                    placeholder="e.g. Elegance — Mens Wear"
                    style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                    Showroom Address:
                  </label>
                  <input
                    type="text"
                    value={settings.storeAddress}
                    onChange={e => updateSettings({ storeAddress: e.target.value })}
                    placeholder="e.g. Mirpur-10, Dhaka"
                    style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                    Hotline / Phone:
                  </label>
                  <input
                    type="text"
                    value={settings.storePhone}
                    onChange={e => updateSettings({ storePhone: e.target.value })}
                    placeholder="e.g. 01700-000000"
                    style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Preview of 58mm Receipt */}
        <div style={{
          flex: 1,
          maxHeight: '430px',
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
            width: `${Math.round(printableWidth * 4.6)}px`,
            maxWidth: '260px',
            backgroundColor: '#ffffff',
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
            borderRadius: '4px',
            padding: `10px ${Math.max(4, Math.round(rightMargin * 3.8))}px 10px 8px`,
            fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
            fontSize: `${baseFontSize}px`,
            fontWeight: 700,
            lineHeight: 1.2,
            color: '#000000',
            transform: `translate(${hOffset * 2.8}px, ${vOffset * 2.8}px)`,
            boxSizing: 'border-box'
          }}>
            {/* Store Header */}
            {settings.showStoreHeader && (
              <div style={{ textAlign: 'center', borderBottom: '1.5px dashed #000000', paddingBottom: '5px', marginBottom: '5px' }}>
                <div style={{ fontSize: `${titleFontSize}px`, fontWeight: 900, textTransform: 'uppercase', color: '#000000' }}>{settings.storeName || 'RAJMAHAL'}</div>
                {settings.storeSubtitle && (
                  <div style={{ fontSize: `${baseFontSize * 0.85}px`, fontWeight: 800, textTransform: 'uppercase', color: '#000000' }}>{settings.storeSubtitle}</div>
                )}
                {settings.storeAddress && (
                  <div style={{ fontSize: `${baseFontSize * 0.8}px`, fontWeight: 700, color: '#000000' }}>{settings.storeAddress}</div>
                )}
                {settings.storePhone && (
                  <div style={{ fontSize: `${baseFontSize * 0.8}px`, fontWeight: 700, color: '#000000' }}>Phone: {settings.storePhone}</div>
                )}
              </div>
            )}

            {/* Invoice Details */}
            {settings.showInvoiceDetails && (
              <div style={{ fontSize: `${baseFontSize * 0.9}px`, fontWeight: 700, borderBottom: '1.5px dashed #000000', paddingBottom: '5px', marginBottom: '5px', color: '#000000' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>INV: <strong>{data.invoiceId.toUpperCase().substring(0, 8)}</strong></span>
                  <span>{new Date(data.saleDate || Date.now()).toLocaleDateString()}</span>
                </div>
                {settings.showCustomerPhone && data.customerPhone && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                    <span>Customer:</span>
                    <span><strong>{data.customerPhone}</strong></span>
                  </div>
                )}
              </div>
            )}

            {/* Items List */}
            <div style={{ borderBottom: '1.5px dashed #000000', paddingBottom: '5px', marginBottom: '5px' }}>
              {data.items.map((item, idx) => {
                const productCode = item.sku || item.code;
                return (
                  <div key={idx} style={{ marginBottom: `${settings.itemSpacing * 3.5}px` }}>
                    <div style={{ fontWeight: 900, wordBreak: 'break-word', color: '#000000' }}>
                      {item.name} {item.size || item.color ? `(${[item.size, item.color].filter(Boolean).join('/')})` : ''}
                    </div>
                    {settings.showProductCode && productCode && (
                      <div style={{ fontSize: `${baseFontSize * 0.82}px`, color: '#000000', fontWeight: 800, letterSpacing: '0.2px' }}>
                        Code: {productCode}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: `${baseFontSize * 0.95}px`, color: '#000000' }}>
                      <span>{item.quantity} × ৳${item.unitPrice.toFixed(0)}</span>
                      <span style={{ fontWeight: 900 }}>৳${item.totalPrice.toFixed(0)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Math & Total */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {data.discountAmount > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#000000' }}>
                    <span>Subtotal:</span>
                    <span>৳${data.totalAmount.toFixed(0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#000000' }}>
                    <span>Discount:</span>
                    <span>-৳${data.discountAmount.toFixed(0)}</span>
                  </div>
                </>
              )}

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: `${totalFontSize}px`,
                fontWeight: 900,
                borderTop: '1.5px solid #000000',
                paddingTop: '4px',
                marginTop: '2px',
                color: '#000000'
              }}>
                <span>TOTAL:</span>
                <span>৳${data.payableAmount.toFixed(0)}</span>
              </div>

              {settings.showPaymentBreakdown && (
                <>
                  {(data.paymentRows || []).filter(r => r.amount > 0).map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: `${baseFontSize * 0.95}px`, fontWeight: 700, color: '#000000' }}>
                      <span>Paid (${r.method}):</span>
                      <span>৳${r.amount.toFixed(0)}</span>
                    </div>
                  ))}
                  {(!data.paymentRows || data.paymentRows.length === 0) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: `${baseFontSize * 0.95}px`, fontWeight: 700, color: '#000000' }}>
                      <span>Paid (${data.paymentMethod}):</span>
                      <span>৳${data.receivedAmount.toFixed(0)}</span>
                    </div>
                  )}
                  {data.dueAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, color: '#000000' }}>
                      <span>DUE:</span>
                      <span>৳${data.dueAmount.toFixed(0)}</span>
                    </div>
                  )}
                  {data.changeAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000000', fontWeight: 800 }}>
                      <span>Change:</span>
                      <span>৳${data.changeAmount.toFixed(0)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ textAlign: 'center', fontSize: `${baseFontSize * 0.8}px`, fontWeight: 800, color: '#000000', marginTop: '8px', borderTop: '1.5px dashed #000000', paddingTop: '4px' }}>
              {settings.footerText || 'Thank You! • Visit Again'}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #eef2f6', paddingTop: '10px', marginTop: '10px' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            Close
          </button>
          {onNewSale && (
            <button className="btn btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }} onClick={onNewSale}>
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
