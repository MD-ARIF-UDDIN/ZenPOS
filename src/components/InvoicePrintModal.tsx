import React, { useState } from 'react';
import { Printer, X, Sliders, RefreshCw, Store, AlertCircle } from 'lucide-react';
import logoImg from '../assets/logo.jpg';

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
  paperWidth: number; // physical paper roll width in mm (58mm)
  contentWidth: number; // printable width in mm (safe max 44-46mm for 384-dot head)
  leftIndent: number; // legacy
  rightShift: number; // in mm, moves content rightward to center on 58mm paper roll
  verticalOffset: number; // in mm
  fontScale: number; // in %
  itemSpacing: number; // in mm
  showLogo: boolean;
  logoSize: number; // in px (default 22px, very small and compact)
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
  contentWidth: 43, // 43mm safe width
  leftIndent: 2.5,
  rightShift: 2.5, // 2.5mm shift right centers perfectly on 58mm paper without right-edge cut
  verticalOffset: 0,
  fontScale: 105,
  itemSpacing: 0.4,
  showLogo: true,
  logoSize: 22,
  showStoreHeader: true,
  storeName: 'RAJMAHAL',
  storeSubtitle: 'Elegance — Mens Wear',
  storeAddress: 'Laxmi Square - 2nd Floor, Jaldi, Banskhali',
  storePhone: '',
  showInvoiceDetails: true,
  showCustomerPhone: true,
  showProductCode: true,
  showPaymentBreakdown: true,
  footerText: 'Thank you for your shopping!'
};

const getSavedInvoiceSettings = (): InvoicePrintSettings => {
  try {
    const raw = localStorage.getItem('pos_invoice_print_settings_58mm_v11');
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
      // Ensure contentWidth + rightShift doesn't exceed 47.5mm printhead limit to prevent cutting
      if (next.rightShift !== undefined && next.contentWidth !== undefined) {
        if (next.rightShift + next.contentWidth > 47.5) {
          next.contentWidth = Math.max(34, 47.5 - next.rightShift);
        }
      }
      localStorage.setItem('pos_invoice_print_settings_58mm_v11', JSON.stringify(next));
      return next;
    });
  };

  const resetSettings = () => {
    setSettings(DEFAULT_INVOICE_SETTINGS);
    localStorage.setItem('pos_invoice_print_settings_58mm_v11', JSON.stringify(DEFAULT_INVOICE_SETTINGS));
  };

  const applyPreset = (preset: 'safe42' | 'compact40' | 'standard45' | 'wide48') => {
    if (preset === 'safe42') {
      updateSettings({ contentWidth: 43, rightShift: 2.5, fontScale: 105 });
    } else if (preset === 'compact40') {
      updateSettings({ contentWidth: 40, rightShift: 3.5, fontScale: 100 });
    } else if (preset === 'standard45') {
      updateSettings({ contentWidth: 44, rightShift: 2.0, fontScale: 108 });
    } else if (preset === 'wide48') {
      updateSettings({ contentWidth: 45.5, rightShift: 1.0, fontScale: 112 });
    }
  };

  const scale = (settings.fontScale || 105) / 100;
  const baseFontSize = 11.5 * scale;
  const titleFontSize = 15.5 * scale;
  const totalFontSize = 14.5 * scale;
  const contentWidth = Math.min(46, settings.contentWidth || 43);
  const rightShift = Math.max(0, settings.rightShift ?? 2.5);
  const vOffset = settings.verticalOffset || 0;

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
              line-height: 1.25 !important;
              -webkit-font-smoothing: antialiased !important;
              text-rendering: optimizeLegibility !important;
              overflow: visible !important;
            }
            .receipt-container {
              width: ${contentWidth}mm !important;
              max-width: ${contentWidth}mm !important;
              margin-left: ${rightShift.toFixed(1)}mm !important;
              margin-right: auto !important;
              margin-top: ${Math.max(0, vOffset).toFixed(1)}mm !important;
              padding-top: 1mm !important;
              padding-bottom: 2mm !important;
              padding-left: 0 !important;
              padding-right: 0 !important;
              box-sizing: border-box !important;
              page-break-after: avoid !important;
              page-break-before: avoid !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              break-after: avoid !important;
            }
            .store-header {
              text-align: center !important;
              border-bottom: 2px dashed #000000 !important;
              padding-bottom: 1.2mm !important;
              margin-bottom: 1.5mm !important;
            }
            .store-logo {
              width: ${settings.logoSize || 22}px !important;
              height: ${settings.logoSize || 22}px !important;
              object-fit: contain !important;
              border-radius: 3px !important;
              filter: grayscale(100%) contrast(150%) !important;
              display: block !important;
              margin: 0 auto 1mm auto !important;
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
              margin: 0.4mm 0 0 0 !important;
              color: #000000 !important;
            }
            .store-contact {
              font-size: ${(baseFontSize * 0.82).toFixed(1)}px !important;
              font-weight: 700 !important;
              margin: 0.3mm 0 0 0 !important;
              color: #000000 !important;
            }
            .meta-section {
              font-size: ${(baseFontSize * 0.9).toFixed(1)}px !important;
              font-weight: 700 !important;
              border-bottom: 2px dashed #000000 !important;
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
              border-bottom: 2px dashed #000000 !important;
              padding-bottom: 1.2mm !important;
              margin-bottom: 1.5mm !important;
            }
            .item-row {
              display: flex !important;
              flex-direction: column !important;
              width: 100% !important;
              box-sizing: border-box !important;
              word-break: break-word !important;
              overflow-wrap: break-word !important;
            }
            .item-name {
              font-weight: 900 !important;
              word-break: break-word !important;
              overflow-wrap: break-word !important;
              line-height: 1.2 !important;
              color: #000000 !important;
            }
            .item-code {
              font-size: ${(baseFontSize * 0.85).toFixed(1)}px !important;
              font-weight: 800 !important;
              color: #000000 !important;
              letter-spacing: 0.2px !important;
              line-height: 1.15 !important;
            }
            .item-details {
              display: flex !important;
              justify-content: space-between !important;
              align-items: center !important;
              width: 100% !important;
              box-sizing: border-box !important;
              font-weight: 800 !important;
              font-size: ${(baseFontSize * 0.95).toFixed(1)}px !important;
              color: #000000 !important;
            }
            .item-price {
              font-weight: 900 !important;
              color: #000000 !important;
              flex-shrink: 0 !important;
              padding-left: 2mm !important;
            }
            .math-section {
              display: flex !important;
              flex-direction: column !important;
              gap: 0.5mm !important;
            }
            .math-row {
              display: flex !important;
              justify-content: space-between !important;
              align-items: center !important;
              font-weight: 800 !important;
              color: #000000 !important;
            }
            .total-row {
              display: flex !important;
              justify-content: space-between !important;
              align-items: center !important;
              font-size: ${totalFontSize.toFixed(1)}px !important;
              font-weight: 900 !important;
              border-top: 2px solid #000000 !important;
              padding-top: 1mm !important;
              margin-top: 0.5mm !important;
              color: #000000 !important;
            }
            .footer-note {
              text-align: center !important;
              font-size: ${(baseFontSize * 0.85).toFixed(1)}px !important;
              font-weight: 900 !important;
              margin-top: 2mm !important;
              border-top: 2px dashed #000000 !important;
              padding-top: 1.2mm !important;
              color: #000000 !important;
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            ${settings.showStoreHeader ? `
              <div class="store-header">
                ${settings.showLogo ? `<img src="${logoImg}" class="store-logo" alt="Logo" />` : ''}
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
              ${settings.footerText || 'Thank you for your shopping!'}
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
        maxWidth: '740px',
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
              Rongta 335A Anti-Cut Printing Engine (Safe 42mm Head Width)
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

        {/* Printer Switching Tip */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '5px',
          padding: '6px 10px',
          marginBottom: '8px',
          fontSize: '11px',
          color: '#1e40af'
        }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>
            <strong>Printer Setting:</strong> In print dialog, ensure <strong>Destination: Rongta 335A</strong>, <strong>Paper: 58mm</strong>, and <strong>Margins: None (0)</strong>.
          </span>
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
            {/* Tuner Navigation Tabs & Presets */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '6px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
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
                  <Sliders size={11} style={{ display: 'inline', marginRight: '3px' }} /> Width & Alignment
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

              {/* 1-Click Width Presets */}
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>Width Presets:</span>
                <button
                  type="button"
                  onClick={() => applyPreset('safe42')}
                  style={{ padding: '2px 6px', fontSize: '10px', fontWeight: 700, borderRadius: '3px', border: '1px solid #bfdbfe', backgroundColor: contentWidth === 42 ? '#2563eb' : '#eff6ff', color: contentWidth === 42 ? '#ffffff' : '#1d4ed8', cursor: 'pointer' }}
                >
                  🛡️ 42mm (Anti-Cut)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('compact40')}
                  style={{ padding: '2px 6px', fontSize: '10px', fontWeight: 700, borderRadius: '3px', border: '1px solid #cbd5e1', backgroundColor: contentWidth === 40 ? '#2563eb' : '#ffffff', color: contentWidth === 40 ? '#ffffff' : '#475569', cursor: 'pointer' }}
                >
                  40mm
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('standard45')}
                  style={{ padding: '2px 6px', fontSize: '10px', fontWeight: 700, borderRadius: '3px', border: '1px solid #cbd5e1', backgroundColor: contentWidth === 45 ? '#2563eb' : '#ffffff', color: contentWidth === 45 ? '#ffffff' : '#475569', cursor: 'pointer' }}
                >
                  45mm
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('wide48')}
                  style={{ padding: '2px 6px', fontSize: '10px', fontWeight: 700, borderRadius: '3px', border: '1px solid #cbd5e1', backgroundColor: contentWidth === 48 ? '#2563eb' : '#ffffff', color: contentWidth === 48 ? '#ffffff' : '#475569', cursor: 'pointer' }}
                >
                  48mm
                </button>
                <button
                  type="button"
                  onClick={resetSettings}
                  style={{ padding: '2px 6px', fontSize: '10px', fontWeight: 600, borderRadius: '3px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#64748b', cursor: 'pointer' }}
                >
                  Reset
                </button>
              </div>
            </div>

            {activeTab === 'adjust' ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '10px' }}>
                  {/* 1. Print Width */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                      <span>Print Width:</span>
                      <span style={{ color: '#2563eb' }}>{contentWidth} mm</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <button type="button" onClick={() => updateSettings({ contentWidth: Math.max(32, contentWidth - 1) })} style={{ width: '24px', height: '22px', fontSize: '11px', fontWeight: 800, border: '1px solid #cbd5e1', borderRadius: '3px', background: '#fff', cursor: 'pointer' }}>-</button>
                      <input 
                        type="range" 
                        min="32" 
                        max="56" 
                        step="1" 
                        value={contentWidth} 
                        onChange={e => updateSettings({ contentWidth: parseInt(e.target.value) })}
                        style={{ flex: 1, accentColor: '#2563eb', cursor: 'pointer' }} 
                      />
                      <button type="button" onClick={() => updateSettings({ contentWidth: Math.min(56, contentWidth + 1) })} style={{ width: '24px', height: '22px', fontSize: '11px', fontWeight: 800, border: '1px solid #cbd5e1', borderRadius: '3px', background: '#fff', cursor: 'pointer' }}>+</button>
                    </div>
                  </div>

                  {/* 2. Shift Right (Center on Paper) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                      <span>Shift Right (Center):</span>
                      <span style={{ color: '#2563eb' }}>+{rightShift} mm</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <button type="button" onClick={() => updateSettings({ rightShift: Math.max(0, parseFloat((rightShift - 0.5).toFixed(1))) })} style={{ width: '24px', height: '22px', fontSize: '11px', fontWeight: 800, border: '1px solid #cbd5e1', borderRadius: '3px', background: '#fff', cursor: 'pointer' }}>◀</button>
                      <input 
                        type="range" 
                        min="0" 
                        max="8" 
                        step="0.5" 
                        value={rightShift} 
                        onChange={e => updateSettings({ rightShift: parseFloat(e.target.value) })}
                        style={{ flex: 1, accentColor: '#2563eb', cursor: 'pointer' }} 
                      />
                      <button type="button" onClick={() => updateSettings({ rightShift: Math.min(8, parseFloat((rightShift + 0.5).toFixed(1))) })} style={{ width: '24px', height: '22px', fontSize: '11px', fontWeight: 800, border: '1px solid #cbd5e1', borderRadius: '3px', background: '#fff', cursor: 'pointer' }}>▶</button>
                    </div>
                    <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '1px' }}>2.5mm = perfect center on 58mm roll</div>
                  </div>

                  {/* 3. Vertical Offset */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                      <span>Vertical Shift:</span>
                      <span style={{ color: vOffset === 0 ? '#64748b' : '#2563eb' }}>{vOffset > 0 ? '+' : ''}{vOffset} mm</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <button type="button" onClick={() => updateSettings({ verticalOffset: Math.max(-10, vOffset - 0.5) })} style={{ width: '24px', height: '22px', fontSize: '11px', fontWeight: 800, border: '1px solid #cbd5e1', borderRadius: '3px', background: '#fff', cursor: 'pointer' }}>▲</button>
                      <input 
                        type="range" 
                        min="-10" 
                        max="15" 
                        step="0.5" 
                        value={vOffset} 
                        onChange={e => updateSettings({ verticalOffset: parseFloat(e.target.value) })}
                        style={{ flex: 1, accentColor: '#2563eb', cursor: 'pointer' }} 
                      />
                      <button type="button" onClick={() => updateSettings({ verticalOffset: Math.min(15, vOffset + 0.5) })} style={{ width: '24px', height: '22px', fontSize: '11px', fontWeight: 800, border: '1px solid #cbd5e1', borderRadius: '3px', background: '#fff', cursor: 'pointer' }}>▼</button>
                    </div>
                  </div>

                  {/* 4. Font Size Scale */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                      <span>Font Size Scale:</span>
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

                  {/* 5. Item Spacing */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                      <span>Item Gap:</span>
                      <span style={{ color: '#2563eb' }}>{settings.itemSpacing} mm</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.2" 
                      max="3.0" 
                      step="0.1" 
                      value={settings.itemSpacing} 
                      onChange={e => updateSettings({ itemSpacing: parseFloat(e.target.value) })}
                      style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer' }} 
                    />
                  </div>
                </div>

                {/* Feature Toggles */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', borderTop: '1px dashed #cbd5e1', paddingTop: '6px', fontSize: '11px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 600 }}>
                    <input 
                      type="checkbox" 
                      checked={settings.showLogo} 
                      onChange={e => updateSettings({ showLogo: e.target.checked })} 
                      style={{ accentColor: '#2563eb' }}
                    />
                    <span>Store Logo</span>
                  </label>
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
                    placeholder="e.g. Laxmi Square - 2nd Floor, Jaldi, Banskhali"
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
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                    Footer Greeting:
                  </label>
                  <input
                    type="text"
                    value={settings.footerText}
                    onChange={e => updateSettings({ footerText: e.target.value })}
                    placeholder="Thank you for your shopping!"
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
          {/* Outer roll wrapper — simulates 58mm paper width */}
          <div style={{ width: '220px', flexShrink: 0, display: 'flex', justifyContent: 'flex-start', paddingLeft: `${Math.max(0, rightShift * 3.6)}px`, paddingTop: `${Math.max(0, vOffset * 3)}px` }}>
          {/* Simulated content area, centered with exact left offset */}
          <div style={{
            width: `${Math.round(contentWidth * 4.6)}px`,
            maxWidth: '210px',
            backgroundColor: '#ffffff',
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
            borderRadius: '4px',
            paddingTop: '8px',
            paddingBottom: '12px',
            paddingLeft: '8px',
            paddingRight: '8px',
            fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
            fontSize: `${baseFontSize}px`,
            fontWeight: 700,
            lineHeight: 1.25,
            color: '#000000',
            boxSizing: 'border-box'
          }}>
            {/* Store Header */}
            {settings.showStoreHeader && (
              <div style={{ textAlign: 'center', borderBottom: '2px dashed #000000', paddingBottom: '6px', marginBottom: '6px' }}>
                {settings.showLogo && (
                  <img 
                    src={logoImg} 
                    alt="Logo" 
                    style={{ 
                      width: `${settings.logoSize || 22}px`, 
                      height: `${settings.logoSize || 22}px`, 
                      objectFit: 'contain', 
                      borderRadius: '3px', 
                      filter: 'grayscale(100%) contrast(150%)', 
                      display: 'block', 
                      margin: '0 auto 3px auto' 
                    }} 
                  />
                )}
                <div style={{ fontSize: `${titleFontSize}px`, fontWeight: 900, textTransform: 'uppercase', color: '#000000' }}>{settings.storeName || 'RAJMAHAL'}</div>
                {settings.storeSubtitle && (
                  <div style={{ fontSize: `${baseFontSize * 0.85}px`, fontWeight: 800, textTransform: 'uppercase', color: '#000000' }}>{settings.storeSubtitle}</div>
                )}
                {settings.storeAddress && (
                  <div style={{ fontSize: `${baseFontSize * 0.82}px`, fontWeight: 700, color: '#000000' }}>{settings.storeAddress}</div>
                )}
                {settings.storePhone && (
                  <div style={{ fontSize: `${baseFontSize * 0.82}px`, fontWeight: 700, color: '#000000' }}>Phone: {settings.storePhone}</div>
                )}
              </div>
            )}

            {/* Invoice Details */}
            {settings.showInvoiceDetails && (
              <div style={{ fontSize: `${baseFontSize * 0.9}px`, fontWeight: 700, borderBottom: '2px dashed #000000', paddingBottom: '6px', marginBottom: '6px', color: '#000000' }}>
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
            <div style={{ borderBottom: '2px dashed #000000', paddingBottom: '6px', marginBottom: '6px' }}>
              {data.items.map((item, idx) => {
                const productCode = item.sku || item.code;
                return (
                  <div key={idx} style={{ marginBottom: `${settings.itemSpacing * 3.5}px` }}>
                    <div style={{ fontWeight: 900, wordBreak: 'break-word', overflowWrap: 'break-word', color: '#000000' }}>
                      {item.name} {item.size || item.color ? `(${[item.size, item.color].filter(Boolean).join('/')})` : ''}
                    </div>
                    {settings.showProductCode && productCode && (
                      <div style={{ fontSize: `${baseFontSize * 0.85}px`, color: '#000000', fontWeight: 800, letterSpacing: '0.2px' }}>
                        Code: {productCode}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, fontSize: `${baseFontSize * 0.95}px`, color: '#000000' }}>
                      <span>{item.quantity} × ৳${item.unitPrice.toFixed(0)}</span>
                      <span style={{ fontWeight: 900, flexShrink: 0, paddingLeft: '4px' }}>৳${item.totalPrice.toFixed(0)}</span>
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
                alignItems: 'center',
                fontSize: `${totalFontSize}px`,
                fontWeight: 900,
                borderTop: '2px solid #000000',
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

            <div style={{ textAlign: 'center', fontSize: `${baseFontSize * 0.85}px`, fontWeight: 900, color: '#000000', marginTop: '10px', borderTop: '2px dashed #000000', paddingTop: '5px' }}>
              {settings.footerText || 'Thank you for your shopping!'}
            </div>
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
