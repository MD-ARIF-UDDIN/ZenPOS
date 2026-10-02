import React from 'react';
import { Printer, CheckCircle, X, RotateCcw } from 'lucide-react';

export interface ThermalReceiptItem {
  productName: string;
  size?: string;
  color?: string;
  barcode?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ThermalReceiptData {
  saleId: string;
  saleDate?: string | Date;
  items: ThermalReceiptItem[];
  subtotal: number;
  discount: number;
  payableAmount: number;
  totalReceived: number;
  changeAmount: number;
  dueAmount: number;
  paymentMethod: string;
  paymentBreakdown?: { method: string; amount: number }[];
  customerPhone?: string;
}

export const printThermalReceipt58mm = (data: ThermalReceiptData) => {
  let iframe = document.getElementById('receipt-isolated-print-frame') as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'receipt-isolated-print-frame';
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

  const dateStr = data.saleDate
    ? new Date(data.saleDate).toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    : new Date().toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

  const invoiceIdDisplay = data.saleId ? data.saleId.toUpperCase().slice(0, 10) : 'INV-SALE';

  const breakdownHtml = (data.paymentBreakdown || [])
    .filter(p => p.amount > 0)
    .map(p => {
      const labelMap: Record<string, string> = {
        CASH: 'Cash',
        CARD: 'Card',
        BKASH: 'bKash',
        NAGAD: 'Nagad',
        ROCKET: 'Rocket'
      };
      return `
        <div style="display: flex; justify-content: space-between; font-size: 10px; padding-left: 6px; margin-top: 1px;">
          <span>- Paid via ${labelMap[p.method] || p.method}:</span>
          <span>৳${p.amount.toFixed(2)}</span>
        </div>
      `;
    })
    .join('');

  const itemsHtml = data.items
    .map(item => {
      const spec = [item.size, item.color && item.color !== 'None' ? item.color : '']
        .filter(Boolean)
        .join('/');
      return `
        <div style="margin-bottom: 5px; font-size: 11px;">
          <div style="font-weight: 700; word-break: break-word;">${item.productName}</div>
          <div style="display: flex; justify-content: space-between; font-size: 10px; margin-top: 1px; color: #222;">
            <span>${spec ? `[${spec}] ` : ''}${item.quantity} x ৳${item.unitPrice.toFixed(2)}</span>
            <span style="font-weight: 700; color: #000;">৳${item.totalPrice.toFixed(2)}</span>
          </div>
        </div>
      `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Receipt - ${invoiceIdDisplay}</title>
      <style>
        @page {
          size: 58mm auto;
          margin: 0mm !important;
        }
        html, body {
          width: 58mm;
          max-width: 58mm;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #000000 !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Courier New', Courier, monospace;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        * {
          box-sizing: border-box;
        }
        .receipt-container {
          width: 58mm;
          max-width: 58mm;
          padding: 3mm 3mm 8mm 3mm;
          margin: 0 auto;
          font-size: 11px;
          line-height: 1.35;
        }
        .divider {
          border-top: 1px dashed #000000;
          margin: 5px 0;
        }
        .d-flex {
          display: flex;
          justify-content: space-between;
        }
      </style>
    </head>
    <body>
      <div class="receipt-container">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 4px;">
          <div style="font-size: 16px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">RAJMAHAL</div>
          <div style="font-size: 9.5px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-top: 1px;">Elegance — Mens Wear</div>
          <div style="font-size: 8.5px; color: #444; margin-top: 1px;">POS Terminal Sales Receipt</div>
        </div>

        <div class="divider"></div>

        <!-- Meta info -->
        <div style="font-size: 10px; line-height: 1.4;">
          <div class="d-flex">
            <span>Invoice #:</span>
            <span style="font-weight: 700;">${invoiceIdDisplay}</span>
          </div>
          <div class="d-flex">
            <span>Date/Time:</span>
            <span>${dateStr}</span>
          </div>
          <div class="d-flex">
            <span>Pay Mode:</span>
            <span style="font-weight: 700;">${data.paymentMethod}</span>
          </div>
          ${
            data.customerPhone
              ? `<div class="d-flex">
                  <span>Customer:</span>
                  <span style="font-weight: 700;">${data.customerPhone}</span>
                </div>`
              : ''
          }
        </div>

        <div class="divider"></div>

        <!-- Items Table -->
        <div style="margin: 4px 0;">
          ${itemsHtml}
        </div>

        <div class="divider"></div>

        <!-- Summary Totals -->
        <div style="font-size: 11px; line-height: 1.45;">
          <div class="d-flex">
            <span>Subtotal:</span>
            <span style="font-weight: 600;">৳${data.subtotal.toFixed(2)}</span>
          </div>
          ${
            data.discount > 0
              ? `<div class="d-flex" style="color: #000;">
                  <span>Discount:</span>
                  <span style="font-weight: 600;">-৳${data.discount.toFixed(2)}</span>
                </div>`
              : ''
          }
          <div class="d-flex" style="font-size: 13px; font-weight: 900; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 3px 0; margin: 4px 0;">
            <span>TOTAL PAYABLE:</span>
            <span>৳${data.payableAmount.toFixed(2)}</span>
          </div>
          <div class="d-flex">
            <span>Amount Received:</span>
            <span style="font-weight: 700;">৳${data.totalReceived.toFixed(2)}</span>
          </div>
          ${breakdownHtml}
          ${
            data.changeAmount > 0
              ? `<div class="d-flex" style="font-weight: 700; margin-top: 2px;">
                  <span>Change Returned:</span>
                  <span>৳${data.changeAmount.toFixed(2)}</span>
                </div>`
              : ''
          }
          ${
            data.dueAmount > 0
              ? `<div class="d-flex" style="font-weight: 700; margin-top: 2px;">
                  <span>Due Balance:</span>
                  <span>৳${data.dueAmount.toFixed(2)}</span>
                </div>`
              : ''
          }
        </div>

        <div class="divider"></div>

        <!-- Footer -->
        <div style="text-align: center; font-size: 9px; line-height: 1.35; margin-top: 6px;">
          <div style="font-weight: 800; font-size: 10px; text-transform: uppercase;">Thank You For Shopping!</div>
          <div style="margin-top: 2px;">Please come again</div>
          <div style="font-size: 8px; margin-top: 3px; color: #333;">Exchange possible within 7 days with invoice</div>
          <div style="font-size: 7.5px; margin-top: 5px; color: #666;">Software: ZenPOS Cloud POS</div>
        </div>

      </div>
    </body>
    </html>
  `;

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Error triggering receipt print:', e);
    }
  }, 100);
};

interface ThermalReceiptModalProps {
  data: ThermalReceiptData;
  onClose: () => void;
  onNewSale?: () => void;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  data,
  onClose,
  onNewSale
}) => {
  const handlePrint = () => {
    printThermalReceipt58mm(data);
  };

  const invoiceIdDisplay = data.saleId ? data.saleId.toUpperCase().slice(0, 10) : 'INV-SALE';
  const dateStr = data.saleDate
    ? new Date(data.saleDate).toLocaleString()
    : new Date().toLocaleString();

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '12px'
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '380px',
          maxHeight: '94vh',
          overflowY: 'auto',
          backgroundColor: '#ffffff',
          color: '#0f172a',
          padding: '18px',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.2)'
        }}
      >
        {/* Success Header */}
        <div
          style={{
            textAlign: 'center',
            borderBottom: '1px dashed #cbd5e1',
            paddingBottom: '12px',
            marginBottom: '12px',
            position: 'relative'
          }}
        >
          <button
            onClick={onClose}
            type="button"
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '4px'
            }}
            title="Close"
          >
            <X size={18} />
          </button>
          <CheckCircle size={36} style={{ color: 'var(--color-success)', marginBottom: '4px' }} />
          <h3
            style={{
              margin: '2px 0',
              fontSize: '18px',
              fontWeight: 900,
              color: 'var(--color-primary)',
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}
          >
            RAJMAHAL
          </h3>
          <p
            style={{
              fontSize: '10.5px',
              fontWeight: 700,
              color: '#475569',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              margin: 0
            }}
          >
            Elegance — Mens Wear
          </p>
          <div
            style={{
              display: 'inline-block',
              marginTop: '4px',
              fontSize: '10px',
              padding: '2px 8px',
              backgroundColor: '#ecfdf5',
              color: '#047857',
              borderRadius: '9999px',
              fontWeight: 700
            }}
          >
            ✓ Sale Completed (58mm Receipt)
          </div>
        </div>

        {/* Invoice Meta */}
        <div
          style={{
            fontSize: '11.5px',
            marginBottom: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Invoice ID:</span>
            <span style={{ fontWeight: 800, fontFamily: 'monospace' }}>{invoiceIdDisplay}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Date/Time:</span>
            <span>{dateStr}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Payment Mode:</span>
            <span style={{ fontWeight: 700 }}>{data.paymentMethod}</span>
          </div>
          {data.customerPhone && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Customer Phone:</span>
              <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                {data.customerPhone}
              </span>
            </div>
          )}
        </div>

        {/* Items List */}
        <div
          style={{
            borderTop: '1px dashed #cbd5e1',
            borderBottom: '1px dashed #cbd5e1',
            padding: '8px 0',
            marginBottom: '10px'
          }}
        >
          {data.items.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                marginBottom: '4px'
              }}
            >
              <div>
                <span style={{ fontWeight: 600 }}>{item.productName}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px', marginLeft: '4px' }}>
                  ({item.size || 'STD'}{item.color && item.color !== 'None' ? `/${item.color}` : ''}) x {item.quantity}
                </span>
              </div>
              <span style={{ fontWeight: 700 }}>৳{item.totalPrice.toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Totals & Breakdown */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            fontSize: '12px',
            marginBottom: '16px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
            <span style={{ fontWeight: 600 }}>৳{data.subtotal.toFixed(2)}</span>
          </div>
          {data.discount > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                color: 'var(--color-danger)'
              }}
            >
              <span>Discount:</span>
              <span style={{ fontWeight: 600 }}>-৳{data.discount.toFixed(2)}</span>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 900,
              borderTop: '1px solid #e2e8f0',
              paddingTop: '6px',
              fontSize: '14px',
              color: 'var(--color-primary)'
            }}
          >
            <span>Total Payable:</span>
            <span>৳{data.payableAmount.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Amount Received:</span>
            <span style={{ fontWeight: 700 }}>৳{data.totalReceived.toFixed(2)}</span>
          </div>

          {/* Payment Method Breakdown */}
          {data.paymentBreakdown && data.paymentBreakdown.some(p => p.amount > 0) && (
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                borderTop: '1px dashed #e2e8f0',
                paddingTop: '4px',
                marginTop: '2px',
                marginBottom: '2px'
              }}
            >
              {data.paymentBreakdown
                .filter(r => r.amount > 0)
                .map(r => (
                  <div
                    key={r.method}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '2px'
                    }}
                  >
                    <span>Paid via {r.method}:</span>
                    <span style={{ fontWeight: 600 }}>৳{r.amount.toFixed(2)}</span>
                  </div>
                ))}
            </div>
          )}

          {data.dueAmount > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 800,
                color: 'var(--color-danger)',
                fontSize: '12.5px',
                borderTop: '1px solid #e2e8f0',
                paddingTop: '4px'
              }}
            >
              <span>Due Balance:</span>
              <span>৳{data.dueAmount.toFixed(2)}</span>
            </div>
          )}
          {data.changeAmount > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 800,
                color: 'var(--color-success)',
                fontSize: '12.5px',
                borderTop: '1px solid #e2e8f0',
                paddingTop: '4px'
              }}
            >
              <span>Change Returned:</span>
              <span>৳{data.changeAmount.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              flex: 1,
              borderColor: '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '9px 12px',
              fontWeight: 700
            }}
            onClick={handlePrint}
          >
            <Printer size={16} /> Print 58mm
          </button>
          {onNewSale && (
            <button
              type="button"
              className="btn btn-primary"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '9px 12px',
                fontWeight: 800
              }}
              onClick={onNewSale}
            >
              <RotateCcw size={15} /> New Sale (Esc)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
