import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer, X, Info } from 'lucide-react';
import type { ProductVariant } from '../store';

interface BarcodeLabelModalProps {
  variant: ProductVariant;
  productName: string;
  onClose: () => void;
}

type LabelSizeType = 'thermal-45-35' | 'thermal-35-45' | 'thermal-50-30' | 'thermal-38-25' | 'compact';
type OrientationType = 'normal' | 'rotated-minus-90' | 'rotated-plus-90';

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({ variant, productName, onClose }) => {
  const [copies, setCopies] = useState<number>(1);
  const [labelSize, setLabelSize] = useState<LabelSizeType>('thermal-45-35');
  const [orientation, setOrientation] = useState<OrientationType>('rotated-minus-90');
  const [offsetX, setOffsetX] = useState<number>(0); // true page horizontal nudge in mm
  const [offsetY, setOffsetY] = useState<number>(0); // true page vertical nudge in mm
  const [storeName, setStoreName] = useState<string>('RAJMAHAL');
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [hasDiscount, setHasDiscount] = useState<boolean>(false);
  const [discountPrice, setDiscountPrice] = useState<number>(variant.selling_price);
  const [promoBadge, setPromoBadge] = useState<string>('SPECIAL OFFER');
  const barcodeRefs = useRef<(SVGSVGElement | null)[]>([]);

  const getSizeConfig = (size: LabelSizeType, orient: OrientationType) => {
    let width = '45mm';
    let height = '35mm';
    let cardW = '200px';
    let cardH = '160px';

    if (size === 'thermal-45-35') {
      width = '45mm';
      height = '35mm';
      cardW = '200px';
      cardH = '160px';
    } else if (size === 'thermal-35-45') {
      width = '35mm';
      height = '45mm';
      cardW = '160px';
      cardH = '205px';
    } else if (size === 'thermal-50-30') {
      width = '50mm';
      height = '30mm';
      cardW = '210px';
      cardH = '135px';
    } else if (size === 'thermal-38-25') {
      width = '38mm';
      height = '25mm';
      cardW = '165px';
      cardH = '120px';
    } else if (size === 'compact') {
      width = '30mm';
      height = '20mm';
      cardW = '145px';
      cardH = '100px';
    }

    const isRotated = orient !== 'normal';
    const rotDeg = orient === 'rotated-minus-90' ? -90 : (orient === 'rotated-plus-90' ? 90 : 0);

    return {
      cardWidth: cardW,
      cardHeight: cardH,
      cardPadding: '2px 4px',
      storeFontSize: '11px',
      subFontSize: '7.5px',
      prodFontSize: '9.5px',
      specFontSize: '8.5px',
      priceFontSize: '11.5px',
      offerFontSize: '12px',
      barcodeWidth: 1.1,
      barcodeHeight: 18,
      barcodeFontSize: 9,
      printWidth: width,
      printHeight: height,
      isRotated: isRotated,
      rotDeg: rotDeg
    };
  };

  const config = getSizeConfig(labelSize, orientation);

  useEffect(() => {
    barcodeRefs.current.forEach((svgEl) => {
      if (svgEl && variant.barcode) {
        try {
          JsBarcode(svgEl, variant.barcode, {
            format: 'CODE128',
            width: config.barcodeWidth,
            height: config.barcodeHeight,
            displayValue: true,
            fontSize: config.barcodeFontSize,
            font: 'monospace',
            fontOptions: 'bold',
            margin: 0,
            textMargin: 1
          });
        } catch (e) {
          console.error('Failed to generate barcode SVG', e);
        }
      }
    });
  }, [variant.barcode, copies, labelSize, orientation, hasDiscount, config]);

  const handlePrint = () => {
    let iframe = document.getElementById('barcode-isolated-print-frame') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'barcode-isolated-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    const width = config.printWidth;
    const height = config.printHeight;

    const stickerItemsHtml = Array.from({ length: copies }).map((_, idx) => {
      const svgEl = barcodeRefs.current[idx];
      const svgHtml = svgEl ? svgEl.outerHTML : '';
      return `
        <div class="print-label">
          <div class="print-content">
            <!-- 1. Store Header (Top) -->
            <div style="font-family: 'Outfit', sans-serif; font-size: ${config.storeFontSize}; font-weight: 900; letter-spacing: 0.5px; color: #000000; text-transform: uppercase; line-height: 1.1; margin: 0 auto; text-align: center; width: 100%; word-break: break-word;">
              ${storeName}
            </div>
            <div style="font-size: ${config.subFontSize}; font-weight: 700; letter-spacing: 0.3px; color: #333333; text-transform: uppercase; line-height: 1; margin: 1px auto 0 auto; text-align: center; width: 100%;">
              Elegance — Mens Wear
            </div>

            <!-- 2. Product Name -->
            <div style="font-size: ${config.prodFontSize}; font-weight: 800; color: #000000; margin: 1.5px auto 0 auto; width: 100%; line-height: 1.15; text-align: center; word-break: break-word; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
              ${productName}
            </div>

            <!-- 3. Size & Color Spec -->
            <div style="font-size: ${config.specFontSize}; color: #111111; font-weight: 700; line-height: 1; margin: 1px auto 0 auto; text-align: center; width: 100%;">
              ${variant.size ? `Size: ${variant.size}` : ''} ${variant.color ? ` • ${variant.color}` : ''}
            </div>

            <!-- 4. Barcode SVG (Center) -->
            <div style="margin: 1.5px auto; width: 100%; display: flex; justify-content: center; align-items: center; text-align: center; overflow: hidden;">
              ${svgHtml}
            </div>

            <!-- 5. Price Tag (Bottom) -->
            ${showPrice ? `
              <div style="border-top: 1px dashed #222222; width: 100%; padding-top: 1.5px; margin: 1px auto 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
                ${hasDiscount ? `
                  <div style="width: 100%; display: flex; justify-content: center; align-items: center; gap: 4px; text-align: center;">
                    <span style="font-size: ${config.specFontSize}; font-weight: 700; color: #555555; text-decoration: line-through;">
                      ৳${variant.selling_price.toFixed(0)}
                    </span>
                    <span style="font-size: ${config.offerFontSize}; font-weight: 900; color: #000000;">
                      ৳${discountPrice.toFixed(0)}
                    </span>
                  </div>
                  ${promoBadge ? `<div style="font-size: ${config.subFontSize}; font-weight: 800; border: 1px solid #000; padding: 0 3px; border-radius: 2px; text-transform: uppercase; line-height: 1; margin-top: 1px;">${promoBadge}</div>` : ''}
                ` : `
                  <div style="font-size: ${config.priceFontSize}; font-weight: 900; color: #000000; letter-spacing: 0.3px; line-height: 1.1; text-align: center; width: 100%;">
                    MRP: ৳${variant.selling_price.toFixed(2)}
                  </div>
                `}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    const contentWidth = config.isRotated ? height : width;
    const contentHeight = config.isRotated ? width : height;
    
    // Page-space translation applied before rotation so X is true horizontal and Y is true vertical
    const rotTransform = config.isRotated 
      ? `translate(calc(-50% + ${offsetX}mm), calc(-50% + ${offsetY}mm)) rotate(${config.rotDeg}deg)`
      : `translate(${offsetX}mm, ${offsetY}mm)`;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title> </title>
          <style>
            @page {
              size: ${width} ${height};
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
              width: ${width} !important;
              height: ${height} !important;
              background: #ffffff !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Outfit', 'Plus Jakarta Sans', sans-serif;
              text-align: center !important;
              overflow: hidden !important;
            }
            .print-wrapper {
              display: block !important;
              width: ${width} !important;
              margin: 0 auto !important;
              padding: 0 !important;
              text-align: center !important;
            }
            .print-label {
              position: relative !important;
              width: ${width} !important;
              height: ${height} !important;
              max-width: ${width} !important;
              max-height: ${height} !important;
              margin: 0 auto !important;
              padding: 0 !important;
              overflow: hidden !important;
              background: #ffffff !important;
              box-sizing: border-box !important;
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .print-content {
              ${config.isRotated ? `
                position: absolute !important;
                top: 50% !important;
                left: 50% !important;
                width: ${contentWidth} !important;
                height: ${contentHeight} !important;
                transform: ${rotTransform} !important;
                transform-origin: center center !important;
              ` : `
                width: 100% !important;
                height: 100% !important;
                transform: ${rotTransform} !important;
              `}
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              justify-content: center !important;
              text-align: center !important;
              box-sizing: border-box !important;
              padding: 1mm 1.5mm !important;
              overflow: hidden !important;
            }
            .print-label:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            svg {
              max-width: 100% !important;
              height: auto !important;
              display: block !important;
              margin: 0 auto !important;
              text-align: center !important;
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
    }, 250);
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
        maxWidth: '820px',
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
              Print Barcode Stickers & Price Tags
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              {productName} — ({variant.color || 'Default'} / {variant.size || 'Free Size'})
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
          gap: '8px',
          alignItems: 'flex-end',
          backgroundColor: 'var(--bg-primary)',
          padding: '10px 12px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '10px',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ width: '55px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Copies</label>
            <input 
              type="number" 
              min="1" 
              max="100" 
              value={copies} 
              onChange={e => setCopies(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
              className="form-control"
              style={{ height: '32px', fontSize: '13px', padding: '4px 6px', textAlign: 'center', fontWeight: 700 }}
            />
          </div>

          <div style={{ minWidth: '150px', flex: '1 1 150px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Roll Paper Size</label>
            <select 
              className="form-control"
              value={labelSize}
              onChange={e => setLabelSize(e.target.value as LabelSizeType)}
              style={{ height: '32px', fontSize: '12px', padding: '4px 8px' }}
            >
              <option value="thermal-45-35">45mm x 35mm (Standard Roll)</option>
              <option value="thermal-35-45">35mm x 45mm (Tall Roll)</option>
              <option value="thermal-50-30">50mm x 30mm (Wide Roll)</option>
              <option value="thermal-38-25">38mm x 25mm (Compact)</option>
              <option value="compact">Jewelry / Mini Tag (30x20)</option>
            </select>
          </div>

          <div style={{ minWidth: '150px', flex: '1 1 150px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Rotation / Flow</label>
            <select
              className="form-control"
              value={orientation}
              onChange={e => setOrientation(e.target.value as OrientationType)}
              style={{ height: '32px', fontSize: '12px', padding: '4px 8px' }}
            >
              <option value="rotated-minus-90">🔄 Rotated -90° (Vertical on 45x35mm)</option>
              <option value="rotated-plus-90">🔄 Rotated +90° (Inverted Vertical)</option>
              <option value="normal">➡️ Normal (0° Horizontal Flow)</option>
            </select>
          </div>

          <div style={{ width: '120px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Nudge Left/Right</label>
            <select
              className="form-control"
              value={offsetX}
              onChange={e => setOffsetX(Number(e.target.value))}
              style={{ height: '32px', fontSize: '12px', padding: '4px 6px', fontWeight: 700 }}
            >
              {[-8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <option key={n} value={n}>
                  {n === 0 ? '0mm (Centered)' : (n > 0 ? `+${n}mm Right` : `${n}mm Left`)}
                </option>
              ))}
            </select>
          </div>

          <div style={{ width: '110px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Nudge Up/Down</label>
            <select
              className="form-control"
              value={offsetY}
              onChange={e => setOffsetY(Number(e.target.value))}
              style={{ height: '32px', fontSize: '12px', padding: '4px 6px' }}
            >
              {[-8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <option key={n} value={n}>
                  {n === 0 ? '0mm (Centered)' : (n > 0 ? `+${n}mm Down` : `${n}mm Up`)}
                </option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: '100px', flex: '1 1 100px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Store Header</label>
            <input 
              type="text" 
              value={storeName} 
              onChange={e => setStoreName(e.target.value)}
              className="form-control"
              style={{ height: '32px', fontSize: '12px', padding: '4px 8px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '6px' }}>
            <input 
              type="checkbox" 
              id="show-price-chk"
              checked={showPrice} 
              onChange={e => setShowPrice(e.target.checked)}
              style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#0b2545' }}
            />
            <label htmlFor="show-price-chk" style={{ fontSize: '12px', fontWeight: 600, color: '#334155', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Show Price
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '6px' }}>
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
              style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#e11d48' }}
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

        {/* Printer Setup Quick Advice Box */}
        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 'var(--radius-sm)',
          padding: '6px 10px',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '11px',
          color: '#1e40af'
        }}>
          <Info size={14} style={{ flexShrink: 0, color: '#3b82f6' }} />
          <span>
            <strong>Calibrated Centering:</strong> <strong>{config.printWidth} x {config.printHeight}</strong> is geometrically auto-centered. In printer settings, ensure <strong>Margins: None</strong> & <strong>Scale: 100%</strong>. Use Nudge if your physical roll feeder has a mechanical shift.
          </span>
        </div>

        {/* Live Printable Preview Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Live Sticker Preview ({copies} {copies === 1 ? 'Label' : 'Labels'} — {config.printWidth} x {config.printHeight})
          </div>

          {/* Printable Labels Grid */}
          <div id="barcode-print-area" style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            justifyContent: 'center'
          }}>
            {Array.from({ length: copies }).map((_, idx) => (
              <div 
                key={idx}
                className="barcode-sticker"
                style={{
                  position: 'relative',
                  width: config.cardWidth,
                  height: config.cardHeight,
                  backgroundColor: '#ffffff',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  textAlign: 'center',
                  boxShadow: 'var(--shadow-xs)'
                }}
              >
                <div style={{
                  position: config.isRotated ? 'absolute' : 'relative',
                  top: config.isRotated ? '50%' : 'auto',
                  left: config.isRotated ? '50%' : 'auto',
                  width: config.isRotated ? config.cardHeight : '100%',
                  height: config.isRotated ? config.cardWidth : '100%',
                  transform: config.isRotated 
                    ? `translate(calc(-50% + ${offsetX * 2}px), calc(-50% + ${offsetY * 2}px)) rotate(${config.rotDeg}deg)`
                    : `translate(${offsetX * 2}px, ${offsetY * 2}px)`,
                  transformOrigin: 'center center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: config.cardPadding,
                  boxSizing: 'border-box'
                }}>
                  {/* 1. Store Name (Top) */}
                  <div style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: config.storeFontSize,
                    fontWeight: 900,
                    letterSpacing: '0.5px',
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
                    fontSize: config.subFontSize,
                    fontWeight: 700,
                    letterSpacing: '0.3px',
                    color: '#64748b',
                    textTransform: 'uppercase',
                    marginBottom: '1px',
                    lineHeight: 1,
                    width: '100%',
                    textAlign: 'center'
                  }}>
                    Elegance — Mens Wear
                  </div>

                  {/* 2. Product Name */}
                  <div style={{
                    fontSize: config.prodFontSize,
                    fontWeight: 800,
                    color: '#1e293b',
                    marginTop: '1.5px',
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

                  {/* 3. Variant Specs */}
                  <div style={{
                    fontSize: config.specFontSize,
                    color: '#334155',
                    fontWeight: 700,
                    marginTop: '1px',
                    lineHeight: 1,
                    width: '100%',
                    textAlign: 'center'
                  }}>
                    {variant.size && `Size: ${variant.size}`} {variant.color && ` • ${variant.color}`}
                  </div>

                  {/* 4. High Quality SVG Barcode */}
                  <div style={{ margin: '1.5px auto', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                    <svg ref={el => { barcodeRefs.current[idx] = el; }} style={{ maxWidth: '100%', height: 'auto', margin: '0 auto', display: 'block' }} />
                  </div>

                  {/* 5. Price Tag (Bottom) */}
                  {showPrice && (
                    <div style={{
                      borderTop: '1px dashed #cbd5e1',
                      width: '100%',
                      paddingTop: '1.5px',
                      marginTop: '1px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center'
                    }}>
                      {hasDiscount ? (
                        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', flexWrap: 'wrap', textAlign: 'center' }}>
                          <span style={{
                            fontSize: config.specFontSize,
                            fontWeight: 700,
                            color: '#94a3b8',
                            textDecoration: 'line-through'
                          }}>
                            ৳${variant.selling_price.toFixed(0)}
                          </span>
                          <span style={{
                            fontSize: config.offerFontSize,
                            fontWeight: 900,
                            color: '#e11d48'
                          }}>
                            ৳${discountPrice.toFixed(0)}
                          </span>
                        </div>
                      ) : (
                        <div style={{
                          fontSize: config.priceFontSize,
                          fontWeight: 900,
                          color: '#0b2545',
                          letterSpacing: '0.3px',
                          lineHeight: 1.1,
                          width: '100%',
                          textAlign: 'center'
                        }}>
                          MRP: ৳{variant.selling_price.toFixed(2)}
                        </div>
                      )}

                      {hasDiscount && promoBadge && (
                        <div style={{
                          fontSize: config.subFontSize,
                          fontWeight: 800,
                          backgroundColor: '#ffe4e6',
                          color: '#e11d48',
                          padding: '1px 4px',
                          borderRadius: '2px',
                          letterSpacing: '0.3px',
                          textTransform: 'uppercase',
                          marginTop: '1px',
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
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #eef2f6', paddingTop: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            🖨️ Geometrically centered for 45mm x 35mm rolls.
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
