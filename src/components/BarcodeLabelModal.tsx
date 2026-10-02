import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer, X } from 'lucide-react';
import type { ProductVariant } from '../store';

interface BarcodeLabelModalProps {
  variant: ProductVariant;
  productName: string;
  onClose: () => void;
}

// Calibrated printer configuration for 35mm x 45mm vertical thermal stickers
const CONFIG = {
  printWidth: '35mm',
  printHeight: '45mm',
  cardWidth: '170px',
  cardHeight: '220px',
  cardPadding: '8px 6px',
  storeFontSize: '11px',
  subFontSize: '7px',
  prodFontSize: '9.5px',
  skuFontSize: '8.5px',
  specFontSize: '8.5px',
  priceFontSize: '13.5px',
  offerFontSize: '14px',
  barcodeWidth: 1.1,
  barcodeHeight: 32,
  barcodeFontSize: 9
};

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({ variant, productName, onClose }) => {
  const [copies, setCopies] = useState<number>(1);
  const [storeName, setStoreName] = useState<string>('RAJMAHAL');
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [hasDiscount, setHasDiscount] = useState<boolean>(false);
  const [discountPrice, setDiscountPrice] = useState<number>(variant.selling_price);
  const [promoBadge, setPromoBadge] = useState<string>('SPECIAL OFFER');
  const [verticalOffset, setVerticalOffset] = useState<number>(() => {
    const saved = localStorage.getItem('pos_barcode_vertical_offset');
    return saved !== null ? parseFloat(saved) : 0;
  });
  const barcodeRefs = useRef<(SVGSVGElement | null)[]>([]);

  const handleOffsetChange = (newVal: number) => {
    const clamped = Math.max(-6, Math.min(6, newVal));
    setVerticalOffset(clamped);
    localStorage.setItem('pos_barcode_vertical_offset', String(clamped));
  };

  useEffect(() => {
    barcodeRefs.current.forEach((svgEl) => {
      const cleanBc = (variant.barcode || '').trim().replace(/[^0-9a-zA-Z]/g, '');
      if (svgEl && cleanBc) {
        try {
          JsBarcode(svgEl, cleanBc, {
            format: 'CODE128',
            width: CONFIG.barcodeWidth,
            height: CONFIG.barcodeHeight,
            displayValue: true,
            fontSize: CONFIG.barcodeFontSize,
            font: 'sans-serif',
            fontOptions: 'bold',
            margin: 0,
            textMargin: 2
          });
        } catch (e) {
          console.error('Failed to generate barcode SVG', e);
        }
      }
    });
  }, [variant.barcode, copies, hasDiscount]);

  const handlePrint = () => {
    let iframe = document.getElementById('barcode-isolated-print-frame') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'barcode-isolated-print-frame';
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

    const cleanBc = (variant.barcode || '').trim().replace(/[^0-9a-zA-Z]/g, '');
    let svgHtml = '';
    if (cleanBc) {
      try {
        const itemSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        JsBarcode(itemSvg, cleanBc, {
          format: 'CODE128',
          width: CONFIG.barcodeWidth,
          height: CONFIG.barcodeHeight,
          displayValue: true,
          fontSize: CONFIG.barcodeFontSize,
          font: 'sans-serif',
          fontOptions: 'bold',
          margin: 0,
          textMargin: 2
        });
        svgHtml = itemSvg.outerHTML;
      } catch (e) {
        console.error('Failed to generate barcode SVG', e);
      }
    }

    const stickerItemsHtml = Array.from({ length: copies }).map(() => `
      <div class="print-label" style="${verticalOffset !== 0 ? `transform: translateY(${verticalOffset}mm);` : ''}">
        <!-- 1. Store Header (Top) -->
        <div class="print-header">
          <div class="store-title">${storeName}</div>
          <div class="store-sub">Elegance — Mens Wear</div>
        </div>

        <!-- 2. Product Name & Specs -->
        <div class="product-info">
          <div class="product-title">${productName}</div>
          ${variant.sku ? `<div class="product-sku">${variant.sku}</div>` : ''}
          <div class="product-spec">
            ${variant.size ? `Size: ${variant.size}` : ''} ${variant.color && variant.color !== 'None' ? ` • ${variant.color}` : ''}
          </div>
        </div>

        <!-- 3. Barcode SVG (Center) -->
        <div class="barcode-box">
          ${svgHtml}
        </div>

        <!-- 4. Price Tag (Bottom) -->
        ${showPrice ? `
          <div class="price-box">
            ${hasDiscount ? `
              <div style="width: 100%; display: flex; justify-content: center; align-items: center; gap: 4px; text-align: center;">
                <span style="font-size: ${CONFIG.specFontSize}; font-weight: 700; color: #555555; text-decoration: line-through;">
                  ৳${variant.selling_price.toFixed(0)}
                </span>
                <span style="font-size: ${CONFIG.offerFontSize}; font-weight: 900; color: #000000;">
                  ৳${discountPrice.toFixed(0)}
                </span>
              </div>
              ${promoBadge ? `<div style="font-size: ${CONFIG.subFontSize}; font-weight: 800; border: 1px solid #000; padding: 0 2px; border-radius: 2px; text-transform: uppercase; line-height: 1; margin-top: 0.3mm;">${promoBadge}</div>` : ''}
            ` : `
              <div class="price-mrp">
                MRP: ৳${variant.selling_price.toFixed(2)}
              </div>
            `}
          </div>
        ` : ''}
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
              size: 35mm 45mm;
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
              width: 35mm !important;
              height: 45mm !important;
              background: #ffffff !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Outfit', 'Plus Jakarta Sans', sans-serif;
              text-align: center !important;
              overflow: hidden !important;
            }
            .print-wrapper {
              width: 35mm !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .print-label {
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              align-items: center !important;
              width: 35mm !important;
              height: 44.5mm !important;
              max-width: 35mm !important;
              max-height: 44.5mm !important;
              margin: 0 auto !important;
              padding: 2.2mm 1.5mm 1.8mm 1.5mm !important;
              box-sizing: border-box !important;
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              overflow: hidden !important;
              background: #ffffff !important;
            }
            .print-label:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            .print-header {
              width: 100% !important;
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              justify-content: center !important;
            }
            .store-title {
              font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif !important;
              font-size: ${CONFIG.storeFontSize} !important;
              font-weight: 900 !important;
              letter-spacing: 0.5px !important;
              color: #000000 !important;
              text-transform: uppercase !important;
              line-height: 1.1 !important;
              margin: 0 !important;
              text-align: center !important;
              width: 100% !important;
              max-width: 32mm !important;
              word-break: break-word !important;
            }
            .store-sub {
              font-size: ${CONFIG.subFontSize} !important;
              font-weight: 700 !important;
              letter-spacing: 0.3px !important;
              color: #222222 !important;
              text-transform: uppercase !important;
              line-height: 1 !important;
              margin-top: 0.3mm !important;
              text-align: center !important;
              width: 100% !important;
            }
            .product-info {
              width: 100% !important;
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              justify-content: center !important;
              margin-top: 0.4mm !important;
            }
            .product-title {
              font-size: ${CONFIG.prodFontSize} !important;
              font-weight: 800 !important;
              color: #000000 !important;
              line-height: 1.15 !important;
              text-align: center !important;
              word-break: break-word !important;
              overflow: hidden !important;
              display: -webkit-box !important;
              -webkit-line-clamp: 2 !important;
              -webkit-box-orient: vertical !important;
              max-width: 32mm !important;
            }
            .product-sku {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Outfit', 'Plus Jakarta Sans', sans-serif !important;
              font-size: ${CONFIG.skuFontSize} !important;
              font-weight: 800 !important;
              color: #111111 !important;
              margin-top: 0.3mm !important;
              letter-spacing: 0.3px !important;
              line-height: 1.1 !important;
              text-align: center !important;
              max-width: 32mm !important;
            }
            .product-spec {
              font-size: ${CONFIG.specFontSize} !important;
              color: #000000 !important;
              font-weight: 800 !important;
              line-height: 1.1 !important;
              margin-top: 0.3mm !important;
              text-align: center !important;
              max-width: 32mm !important;
            }
            .barcode-box {
              width: 100% !important;
              max-width: 32mm !important;
              display: flex !important;
              justify-content: center !important;
              align-items: center !important;
              text-align: center !important;
              margin: 0.4mm 0 !important;
              overflow: hidden !important;
            }
            svg {
              width: 92% !important;
              max-width: 31mm !important;
              height: 13.5mm !important;
              max-height: 14.5mm !important;
              display: block !important;
              margin: 0 auto !important;
              text-align: center !important;
            }
            svg text {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Outfit', sans-serif !important;
              font-weight: 800 !important;
              fill: #000000 !important;
              letter-spacing: 0.5px !important;
            }
            .price-box {
              width: 100% !important;
              max-width: 32mm !important;
              border-top: 1px dashed #000000 !important;
              padding-top: 0.8mm !important;
              margin-top: 0.3mm !important;
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              justify-content: center !important;
              text-align: center !important;
            }
            .price-mrp {
              font-size: ${CONFIG.priceFontSize} !important;
              font-weight: 900 !important;
              color: #000000 !important;
              letter-spacing: 0.3px !important;
              line-height: 1.1 !important;
              text-align: center !important;
              width: 100% !important;
            }
          </style>
        </head>
        <body>
          <div class="print-wrapper">
            ${stickerItemsHtml}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 350);
  };

  return (
    <div style={{
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
    }}>
      {/* Modal Container */}
      <div className="card" style={{
        width: '100%',
        maxWidth: '650px',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'var(--radius-md)',
        padding: '18px',
        backgroundColor: '#ffffff',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eef2f6', paddingBottom: '10px', marginBottom: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Print Barcode Sticker
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              {productName} — ({variant.color || 'Default'} / {variant.size || 'Free Size'}) • <strong>35mm × 45mm</strong> (Evenly Distributed)
            </p>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Configuration Bar */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          backgroundColor: 'var(--bg-primary)',
          padding: '10px 14px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '12px',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ width: '70px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Copies</label>
            <input 
              type="number" 
              min="1" 
              max="100" 
              value={copies} 
              onChange={e => setCopies(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
              className="form-control"
              style={{ height: '34px', fontSize: '13px', padding: '4px 8px', textAlign: 'center', fontWeight: 700 }}
            />
          </div>

          <div style={{ flex: '1 1 140px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Store Header</label>
            <input 
              type="text" 
              value={storeName} 
              onChange={e => setStoreName(e.target.value)}
              className="form-control"
              style={{ height: '34px', fontSize: '12px', padding: '4px 8px' }}
            />
          </div>

          {/* Vertical Position Nudge Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>
              Vertical Align ({verticalOffset > 0 ? `+${verticalOffset}` : verticalOffset}mm)
            </label>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button 
                type="button" 
                onClick={() => handleOffsetChange(verticalOffset - 1)}
                title="Nudge content 1mm higher"
                style={{ height: '28px', padding: '0 8px', fontSize: '11px', fontWeight: 700, borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer' }}
              >
                ▲ Up
              </button>
              <button 
                type="button" 
                onClick={() => handleOffsetChange(0)}
                title="Reset to 0mm center"
                style={{ height: '28px', padding: '0 6px', fontSize: '10.5px', fontWeight: 600, borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f1f5f9', cursor: 'pointer' }}
              >
                Reset
              </button>
              <button 
                type="button" 
                onClick={() => handleOffsetChange(verticalOffset + 1)}
                title="Nudge content 1mm lower"
                style={{ height: '28px', padding: '0 8px', fontSize: '11px', fontWeight: 700, borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer' }}
              >
                ▼ Down
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '18px' }}>
            <input 
              type="checkbox" 
              id="show-price-chk"
              checked={showPrice} 
              onChange={e => setShowPrice(e.target.checked)}
              style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#0b2545' }}
            />
            <label htmlFor="show-price-chk" style={{ fontSize: '12px', fontWeight: 600, color: '#334155', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Show Price
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '18px' }}>
            <input 
              type="checkbox" 
              id="has-discount-chk"
              checked={hasDiscount} 
              onChange={e => {
                setHasDiscount(e.target.checked);
                if (e.target.checked && discountPrice === variant.selling_price) {
                  setDiscountPrice(Math.round(variant.selling_price * 0.9));
                }
              }}
              style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#e11d48' }}
            />
            <label htmlFor="has-discount-chk" style={{ fontSize: '12px', fontWeight: 700, color: '#e11d48', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              🔥 Sale Tag
            </label>
          </div>

          {/* Conditional Discount Fields */}
          {hasDiscount && (
            <div style={{ display: 'flex', gap: '8px', width: '100%', paddingTop: '6px', borderTop: '1px dashed #cbd5e1' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#e11d48', display: 'block', marginBottom: '2px' }}>
                  Sale / Offer Price (৳)
                </label>
                <input 
                  type="number" 
                  value={discountPrice} 
                  onChange={e => setDiscountPrice(Number(e.target.value))}
                  className="form-control"
                  style={{ height: '30px', fontSize: '12px', fontWeight: 700, borderColor: '#fda4af' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>
                  Promo Badge Label
                </label>
                <input 
                  type="text" 
                  value={promoBadge} 
                  onChange={e => setPromoBadge(e.target.value)}
                  placeholder="e.g. SALE, 20% OFF, SPECIAL"
                  className="form-control"
                  style={{ height: '30px', fontSize: '12px' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Live Printable Preview Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Live Sticker Preview ({copies} {copies === 1 ? 'Label' : 'Labels'} — {CONFIG.printWidth} × {CONFIG.printHeight})
          </div>

          {/* Printable Labels Grid */}
          <div id="barcode-print-area" style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            justifyContent: 'center'
          }}>
            {Array.from({ length: copies }).map((_, idx) => (
              <div 
                key={idx}
                className="barcode-sticker"
                style={{
                  position: 'relative',
                  width: CONFIG.cardWidth,
                  height: CONFIG.cardHeight,
                  backgroundColor: '#ffffff',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  textAlign: 'center',
                  boxShadow: 'var(--shadow-xs)'
                }}
              >
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: CONFIG.cardPadding,
                  boxSizing: 'border-box'
                }}>
                  {/* 1. Store Name (Top) */}
                  <div style={{ width: '100%' }}>
                    <div style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: CONFIG.storeFontSize,
                      fontWeight: 900,
                      letterSpacing: '0.4px',
                      color: '#0b2545',
                      textTransform: 'uppercase',
                      lineHeight: '1.1',
                      width: '100%',
                      textAlign: 'center',
                      wordBreak: 'break-word'
                    }}>
                      {storeName}
                    </div>
                    <div style={{
                      fontSize: CONFIG.subFontSize,
                      fontWeight: 700,
                      letterSpacing: '0.2px',
                      color: '#64748b',
                      textTransform: 'uppercase',
                      marginTop: '2px',
                      lineHeight: 1,
                      width: '100%',
                      textAlign: 'center'
                    }}>
                      Elegance — Mens Wear
                    </div>
                  </div>

                  {/* 2. Product Name & Specs */}
                  <div style={{ width: '100%', margin: '2px 0' }}>
                    <div style={{
                      fontSize: CONFIG.prodFontSize,
                      fontWeight: 800,
                      color: '#1e293b',
                      width: '100%',
                      wordBreak: 'break-word',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: 1.15,
                      textAlign: 'center'
                    }}>
                      {productName}
                    </div>

                    {variant.sku && (
                      <div style={{
                        fontSize: CONFIG.skuFontSize,
                        fontWeight: 800,
                        color: '#1e293b',
                        marginTop: '2px',
                        textAlign: 'center',
                        width: '100%',
                        letterSpacing: '0.3px',
                        lineHeight: 1.15
                      }}>
                        {variant.sku}
                      </div>
                    )}

                    <div style={{
                      fontSize: CONFIG.specFontSize,
                      color: '#0f172a',
                      fontWeight: 800,
                      marginTop: '2px',
                      lineHeight: 1.1,
                      width: '100%',
                      textAlign: 'center'
                    }}>
                      {variant.size && `Size: ${variant.size}`} {variant.color && variant.color !== 'None' && ` • ${variant.color}`}
                    </div>
                  </div>

                  {/* 3. High Quality SVG Barcode */}
                  <div style={{ margin: '2px auto', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                    <svg ref={el => { barcodeRefs.current[idx] = el; }} style={{ maxWidth: '92%', maxHeight: '44px', height: 'auto', margin: '0 auto', display: 'block' }} />
                  </div>

                  {/* 4. Price Tag (Bottom) */}
                  {showPrice && (
                    <div style={{
                      borderTop: '1px dashed #cbd5e1',
                      width: '100%',
                      paddingTop: '4px',
                      marginTop: '2px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center'
                    }}>
                      {hasDiscount ? (
                        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', flexWrap: 'wrap', textAlign: 'center' }}>
                          <span style={{
                            fontSize: CONFIG.specFontSize,
                            fontWeight: 700,
                            color: '#94a3b8',
                            textDecoration: 'line-through'
                          }}>
                            ৳${variant.selling_price.toFixed(0)}
                          </span>
                          <span style={{
                            fontSize: CONFIG.offerFontSize,
                            fontWeight: 900,
                            color: '#e11d48'
                          }}>
                            ৳${discountPrice.toFixed(0)}
                          </span>
                        </div>
                      ) : (
                        <div style={{
                          fontSize: CONFIG.priceFontSize,
                          fontWeight: 900,
                          color: '#0b2545',
                          letterSpacing: '0.3px',
                          lineHeight: 1.1,
                          width: '100%',
                          textAlign: 'center'
                        }}>
                          MRP: ৳${variant.selling_price.toFixed(2)}
                        </div>
                      )}

                      {hasDiscount && promoBadge && (
                        <div style={{
                          fontSize: CONFIG.subFontSize,
                          fontWeight: 800,
                          backgroundColor: '#ffe4e6',
                          color: '#e11d48',
                          padding: '1px 4px',
                          borderRadius: '2px',
                          letterSpacing: '0.3px',
                          textTransform: 'uppercase',
                          marginTop: '2px',
                          lineHeight: 1
                        }}>
                          {promoBadge}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #eef2f6', paddingTop: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            🏷️ Centered Vertical Tag (35mm × 45mm Portrait)
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Printer size={14} /> Print {copies} {copies === 1 ? 'Sticker' : 'Stickers'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export interface BatchPrintItem {
  variant: ProductVariant;
  productName: string;
  copies?: number;
}

export const printVariantsBatchLabels = (
  items: BatchPrintItem[],
  storeName: string = 'RAJMAHAL'
) => {
  if (!items || items.length === 0) return;

  let iframe = document.getElementById('barcode-isolated-print-frame') as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'barcode-isolated-print-frame';
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

  const stickerItemsHtml = items.flatMap(({ variant, productName, copies = 1 }) => {
    let svgHtml = '';
    const cleanBc = (variant.barcode || '').trim().replace(/[^0-9a-zA-Z]/g, '');
    if (cleanBc) {
      try {
        const itemSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        JsBarcode(itemSvg, cleanBc, {
          format: 'CODE128',
          width: CONFIG.barcodeWidth,
          height: CONFIG.barcodeHeight,
          displayValue: true,
          fontSize: CONFIG.barcodeFontSize,
          font: 'sans-serif',
          fontOptions: 'bold',
          margin: 0,
          textMargin: 2
        });
        svgHtml = itemSvg.outerHTML;
      } catch (e) {
        console.error('Failed to generate barcode SVG for batch print', e);
      }
    }

    const numCopies = Math.max(1, copies);
    return Array.from({ length: numCopies }).map(() => `
      <div class="print-label">
        <!-- 1. Store Header (Top) -->
        <div class="print-header">
          <div class="store-title">${storeName}</div>
          <div class="store-sub">Elegance — Mens Wear</div>
        </div>

        <!-- 2. Product Name & Specs -->
        <div class="product-info">
          <div class="product-title">${productName}</div>
          ${variant.sku ? `<div class="product-sku">${variant.sku}</div>` : ''}
          <div class="product-spec">
            ${variant.size ? `Size: ${variant.size}` : ''} ${variant.color && variant.color !== 'None' ? ` • ${variant.color}` : ''}
          </div>
        </div>

        <!-- 3. Barcode SVG (Center) -->
        <div class="barcode-box">
          ${svgHtml}
        </div>

        <!-- 4. Price Tag (Bottom) -->
        <div class="price-box">
          <div class="price-mrp">
            MRP: ৳${Number(variant.selling_price).toFixed(2)}
          </div>
        </div>
      </div>
    `);
  }).join('');

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title> </title>
        <style>
          @page {
            size: 35mm 45mm;
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
            width: 35mm !important;
            height: 45mm !important;
            background: #ffffff !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Outfit', 'Plus Jakarta Sans', sans-serif;
            text-align: center !important;
            overflow: hidden !important;
          }
          .print-wrapper {
            width: 35mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-label {
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            align-items: center !important;
            width: 35mm !important;
            height: 44.5mm !important;
            max-width: 35mm !important;
            max-height: 44.5mm !important;
            margin: 0 auto !important;
            padding: 2.2mm 1.5mm 1.8mm 1.5mm !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
            background: #ffffff !important;
          }
          .print-label:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .print-header {
            width: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .store-title {
            font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif !important;
            font-size: ${CONFIG.storeFontSize} !important;
            font-weight: 900 !important;
            letter-spacing: 0.5px !important;
            color: #000000 !important;
            text-transform: uppercase !important;
            line-height: 1.1 !important;
            margin: 0 !important;
            text-align: center !important;
            width: 100% !important;
            max-width: 32mm !important;
            word-break: break-word !important;
          }
          .store-sub {
            font-size: ${CONFIG.subFontSize} !important;
            font-weight: 700 !important;
            letter-spacing: 0.3px !important;
            color: #222222 !important;
            text-transform: uppercase !important;
            line-height: 1 !important;
            margin-top: 0.3mm !important;
            text-align: center !important;
            width: 100% !important;
          }
          .product-info {
            width: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            margin-top: 0.4mm !important;
          }
          .product-title {
            font-size: ${CONFIG.prodFontSize} !important;
            font-weight: 800 !important;
            color: #000000 !important;
            line-height: 1.15 !important;
            text-align: center !important;
            word-break: break-word !important;
            overflow: hidden !important;
            display: -webkit-box !important;
            -webkit-line-clamp: 2 !important;
            -webkit-box-orient: vertical !important;
            max-width: 32mm !important;
          }
          .product-sku {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Outfit', 'Plus Jakarta Sans', sans-serif !important;
            font-size: ${CONFIG.skuFontSize} !important;
            font-weight: 800 !important;
            color: #111111 !important;
            margin-top: 0.3mm !important;
            letter-spacing: 0.3px !important;
            line-height: 1.1 !important;
            text-align: center !important;
            max-width: 32mm !important;
          }
          .product-spec {
            font-size: ${CONFIG.specFontSize} !important;
            color: #000000 !important;
            font-weight: 800 !important;
            line-height: 1.1 !important;
            margin-top: 0.3mm !important;
            text-align: center !important;
            max-width: 32mm !important;
          }
          .barcode-box {
            width: 100% !important;
            max-width: 32mm !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            text-align: center !important;
            margin: 0.4mm 0 !important;
            overflow: hidden !important;
          }
          svg {
            width: 92% !important;
            max-width: 31mm !important;
            height: 13.5mm !important;
            max-height: 14.5mm !important;
            display: block !important;
            margin: 0 auto !important;
            text-align: center !important;
          }
          svg text {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Outfit', sans-serif !important;
            font-weight: 800 !important;
            fill: #000000 !important;
            letter-spacing: 0.5px !important;
          }
          .price-box {
            width: 100% !important;
            max-width: 32mm !important;
            border-top: 1px dashed #000000 !important;
            padding-top: 0.8mm !important;
            margin-top: 0.3mm !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
          }
          .price-mrp {
            font-size: ${CONFIG.priceFontSize} !important;
            font-weight: 900 !important;
            color: #000000 !important;
            letter-spacing: 0.3px !important;
            line-height: 1.1 !important;
            text-align: center !important;
            width: 100% !important;
          }
        </style>
      </head>
      <body>
        <div class="print-wrapper">
          ${stickerItemsHtml}
        </div>
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  }, 350);
};


