import { jsPDF } from 'jspdf';
import { Customer, Transaction } from '../types';
import { Language, formatNumber } from './translations';

function parseTxDate(raw: any): Date {
  if (!raw) return new Date();
  if (raw instanceof Date) return raw;
  if (typeof raw.toDate === 'function') {
    try {
      return raw.toDate();
    } catch {
      return new Date();
    }
  }
  if (typeof raw === 'number') return new Date(raw);
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function safeFormatNumber(val: any, lang: Language): string {
  const num = typeof val === 'number' && !isNaN(val) ? val : Number(val) || 0;
  try {
    return formatNumber(num, lang);
  } catch {
    return String(num);
  }
}

/**
 * Draws an authentic jagged receipt cut edge at the top and bottom.
 */
function drawReceiptSilhouette(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  toothW = 6,
  toothH = 3.5
) {
  ctx.beginPath();
  ctx.moveTo(0, toothH);

  // Top zigzag teeth
  let x = 0;
  while (x < w) {
    ctx.lineTo(x + toothW / 2, 0);
    ctx.lineTo(Math.min(x + toothW, w), toothH);
    x += toothW;
  }

  // Right edge down
  ctx.lineTo(w, h - toothH);

  // Bottom zigzag teeth
  x = w;
  while (x > 0) {
    ctx.lineTo(x - toothW / 2, h);
    ctx.lineTo(Math.max(x - toothW, 0), h - toothH);
    x -= toothW;
  }

  // Left edge up
  ctx.lineTo(0, toothH);
  ctx.closePath();
}

/**
 * Draws Lucide 'corner-down-right' icon on canvas
 * polyline points="15 10 20 15 15 20", path d="M4 4v7a4 4 0 0 0 4 4h12"
 */
function drawCornerDownRight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size = 9,
  color = '#9CA3AF'
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const s = size / 24;

  // Down and turn right path: M4 4v7a4 4 0 0 0 4 4h12
  ctx.beginPath();
  ctx.moveTo(x + 4 * s, y + 4 * s);
  ctx.lineTo(x + 4 * s, y + 11 * s);
  ctx.arcTo(x + 4 * s, y + 15 * s, x + 8 * s, y + 15 * s, 4 * s);
  ctx.lineTo(x + 19 * s, y + 15 * s);
  ctx.stroke();

  // Arrowhead pointing right: polyline points="15 10 20 15 15 20"
  ctx.beginPath();
  ctx.moveTo(x + 14 * s, y + 10 * s);
  ctx.lineTo(x + 19 * s, y + 15 * s);
  ctx.lineTo(x + 14 * s, y + 20 * s);
  ctx.stroke();

  ctx.restore();
}

/**
 * Pre-warms Google Fonts "Lato" (English) & "Noto Sans Bengali" (Bangla) before drawing on canvas.
 * Cached so subsequent receipt generations resolve in 0ms.
 */
let receiptFontsLoadedPromise: Promise<void> | null = null;

function ensureReceiptFontsLoaded(): Promise<void> {
  if (receiptFontsLoadedPromise) {
    return receiptFontsLoadedPromise;
  }
  if (typeof document !== 'undefined' && document.fonts && typeof document.fonts.load === 'function') {
    receiptFontsLoadedPromise = Promise.race([
      Promise.all([
        document.fonts.load('400 16px "Lato"'),
        document.fonts.load('700 16px "Lato"'),
        document.fonts.load('900 22px "Lato"'),
        document.fonts.load('400 16px "Manrope"'),
        document.fonts.load('500 16px "Manrope"'),
        document.fonts.load('600 16px "Manrope"'),
        document.fonts.load('700 16px "Manrope"'),
        document.fonts.load('800 22px "Manrope"'),
        document.fonts.load('600 18px "Bricolage Grotesque"'),
        document.fonts.load('700 24px "Bricolage Grotesque"'),
        document.fonts.load('400 14px "Geist Mono"'),
        document.fonts.load('500 14px "Geist Mono"'),
        document.fonts.load('600 14px "Geist Mono"'),
        document.fonts.load('700 14px "Geist Mono"'),
        document.fonts.load('400 14px "Hind Siliguri"'),
        document.fonts.load('600 14px "Hind Siliguri"'),
        document.fonts.load('700 14px "Hind Siliguri"'),
        document.fonts.load('400 14px "Noto Sans Bengali"'),
        document.fonts.load('500 14px "Noto Sans Bengali"'),
        document.fonts.load('600 14px "Noto Sans Bengali"'),
        document.fonts.load('700 16px "Noto Sans Bengali"'),
        document.fonts.load('800 22px "Noto Sans Bengali"'),
      ]).then(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, 900)),
    ]).catch(() => {
      // Continue gracefully if offline or load fails
    });
    return receiptFontsLoadedPromise;
  }
  receiptFontsLoadedPromise = Promise.resolve();
  return receiptFontsLoadedPromise;
}

if (typeof window !== 'undefined') {
  const prewarm = () => {
    void ensureReceiptFontsLoaded();
  };
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(prewarm, { timeout: 2500 });
  } else {
    setTimeout(prewarm, 1200);
  }
}

function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  y: number,
  x1: number,
  x2: number,
  color = '#2A2D35',
  dash = [4, 3]
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

function drawDoubleLine(
  ctx: CanvasRenderingContext2D,
  y: number,
  x1: number,
  x2: number,
  color = '#353944'
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y - 1.5);
  ctx.lineTo(x2, y - 1.5);
  ctx.moveTo(x1, y + 1.5);
  ctx.lineTo(x2, y + 1.5);
  ctx.stroke();
  ctx.restore();
}

/**
 * Converts a data:image/png;base64 string to a Blob reliably and synchronously.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  try {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
    const binary = atob(parts[1]);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    return new Blob([array], { type: mime });
  } catch (e) {
    console.warn('dataUrlToBlob fallback:', e);
    return new Blob([], { type: 'image/png' });
  }
}

export interface ReceiptImageResult {
  kind?: 'png';
  dataUrl: string;
  blob: Blob;
  fileName: string;
}

export interface CreditCardStatementMeta {
  billingDay: number;
  lastStatementDate: Date;
  nextStatementDate: Date;
  billedStatementAmount: number;
  paidTowardBilled: number;
  unpaidCarryOver: number;
}

export interface CreditCardStatementPdfResult {
  kind: 'pdf';
  blob: Blob;
  fileName: string;
  previewPages: string[];
  plainTextSummary: string;
  billedCount: number;
}

/**
 * Generates an ultra-sharp, high-DPI POS receipt PNG using "Lato" (English)
 * and "Noto Sans Bengali" (Bangla) from Google Fonts. Displays the last 5 transactions
 * with transparent carry-forward opening balance math so all numbers mathematically balance.
 */
export async function generateReceiptPng(
  customer: Customer,
  transactions: Transaction[] = [],
  lang: Language = 'en',
  theme?: 'light' | 'dark'
): Promise<ReceiptImageResult> {
  await ensureReceiptFontsLoaded();

  const isDark = theme
    ? theme === 'dark'
    : typeof document !== 'undefined'
    ? document.documentElement.classList.contains('dark')
    : true;

  // Theme-adaptive receipt color palette
  const colors = isDark
    ? {
        paperBg: '#111215',
        paperBorder: '#23262E',
        dashedLine: '#2A2D35',
        doubleLine: '#353944',
        textPrimary: '#FFFFFF',
        textValue: '#F3F4F6',
        textRowDate: '#E5E7EB',
        textSecondary: '#D1D5DB',
        textMuted: '#9CA3AF',
        textSubtle: '#6B7280',
        due: '#F43F5E',
        paid: '#10B981',
        cyan: '#06B6D4',
        barcode: '#E5E7EB'
      }
    : {
        paperBg: '#FFFFFF',
        paperBorder: '#CBD5E1',
        dashedLine: '#CBD5E1',
        doubleLine: '#94A3B8',
        textPrimary: '#09090B',
        textValue: '#0F172A',
        textRowDate: '#1E293B',
        textSecondary: '#334155',
        textMuted: '#64748B',
        textSubtle: '#64748B',
        due: '#E11D48',
        paid: '#059669',
        cyan: '#0891B2',
        barcode: '#0F172A'
      };

  const customerName = customer?.name?.trim() || (lang === 'bn' ? 'সম্মানিত গ্রাহক' : 'Valued Customer');
  const customerPhone = customer?.phone?.trim() || (lang === 'bn' ? 'প্রযোজ্য নয়' : 'N/A');
  const outstandingDue = typeof customer?.outstandingDue === 'number' && !isNaN(customer.outstandingDue)
    ? customer.outstandingDue
    : Number(customer?.outstandingDue) || 0;

  const cleanPrefix = customerName.replace(/[^\w\u0980-\u09FF]/g, '_').replace(/_+/g, '_').trim() || 'Customer';
  const custId = customer?.id ? String(customer.id) : '000000';
  const safeTransactions = Array.isArray(transactions) ? transactions : [];

  // Default to the last 5 transactions
  const displayTxs = safeTransactions.slice(0, 5);
  const fileName = `${cleanPrefix}_Receipt.png`;

  // 3x Retina resolution (360px base width * 3 = 1080px ultra-HD output)
  const scale = 3;
  const width = 360;
  const padX = 16;
  const contentWidth = width - padX * 2;
  const toothH = 4;

  // Use "Hind Siliguri" & "Noto Sans Bengali" from Google Fonts for Bengali & ৳ currency symbol, and "Lato" for Latin
  const fontStack = (size: number, weight: 'normal' | '500' | '600' | 'bold' | '800' = 'normal') => {
    if (lang === 'bn') {
      const bnWeight = weight === 'normal' ? '400' : weight === 'bold' ? '700' : weight;
      return `${bnWeight} ${size}px "Hind Siliguri", "Noto Sans Bengali", "Lato", system-ui, -apple-system, sans-serif`;
    }
    const latoWeight =
      weight === 'normal' || weight === '500'
        ? '400'
        : weight === '600' || weight === 'bold'
        ? '700'
        : '900';
    return `${latoWeight} ${size}px "Lato", "Hind Siliguri", "Noto Sans Bengali", system-ui, -apple-system, sans-serif`;
  };

  const getRowHeight = (tx: Transaction) => (tx?.description?.trim() ? 42 : 27);
  const rowsHeight = displayTxs.length > 0 
    ? displayTxs.reduce((acc, tx) => acc + getRowHeight(tx), 0)
    : 36;

  const topPad = toothH + 16;
  const headerHeight = 46;
  const metaHeight = 68;
  const openingBalHeight = 32;
  const tableHeaderHeight = 22;
  const tableSpacing = 8;
  const totalsHeight = 66;
  const balanceHeight = 54;
  const barcodeHeight = 48;
  const bottomPad = 12 + toothH;

  const totalHeight = topPad 
    + headerHeight 
    + metaHeight 
    + openingBalHeight 
    + tableHeaderHeight 
    + rowsHeight 
    + tableSpacing 
    + totalsHeight 
    + balanceHeight 
    + barcodeHeight 
    + bottomPad;

  // Create high-resolution canvas
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(totalHeight * scale);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context is not available');
  }

  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Authentic thermal receipt paper (Dark or Light mode)
  ctx.save();
  drawReceiptSilhouette(ctx, width, totalHeight, 6, toothH);
  ctx.fillStyle = colors.paperBg;
  ctx.fill();
  ctx.strokeStyle = colors.paperBorder;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  let curY = toothH + 16;

  // 1. BRAND & HEADER
  const brandTitle = lang === 'bn' ? 'চালান ট্র্যাক' : 'CHALLAN TRACK';
  ctx.textAlign = 'center';
  ctx.fillStyle = colors.textPrimary;
  ctx.font = fontStack(16, 'bold');
  ctx.fillText(brandTitle, width / 2, curY + 14);

  ctx.fillStyle = colors.textMuted;
  ctx.font = fontStack(9, '500');
  const subText = lang === 'bn' ? 'লেনদেন রসিদ ও হিসাব' : 'TRANSACTION RECEIPT';
  ctx.fillText(subText, width / 2, curY + 31);

  curY += 46;
  drawDashedLine(ctx, curY, padX, width - padX, colors.dashedLine);
  curY += 8;

  // 2. METADATA SECTION
  const now = new Date();
  const dateStr = now.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  const slipNo = `CT-${custId.slice(-6).toUpperCase()}`;

  ctx.textAlign = 'left';
  ctx.font = fontStack(9, '600');
  ctx.fillStyle = colors.textMuted;
  ctx.fillText(`${lang === 'bn' ? 'রসিদ নং' : 'SLIP NO'}: `, padX, curY + 11);
  ctx.fillStyle = colors.textValue;
  ctx.font = fontStack(9, 'bold');
  ctx.fillText(slipNo, padX + 48, curY + 11);

  ctx.textAlign = 'right';
  ctx.fillStyle = colors.textMuted;
  ctx.font = fontStack(8.5, 'normal');
  ctx.fillText(`${dateStr} ${timeStr}`, width - padX, curY + 11);

  const displayCustName = customerName.length > 22 ? customerName.slice(0, 20) + '..' : customerName;
  ctx.textAlign = 'left';
  ctx.font = fontStack(9, '600');
  ctx.fillStyle = colors.textMuted;
  ctx.fillText(`${lang === 'bn' ? 'গ্রাহক' : 'CLIENT'}: `, padX, curY + 27);
  ctx.fillStyle = colors.textPrimary;
  ctx.font = fontStack(9.5, 'bold');
  ctx.fillText(displayCustName, padX + 44, curY + 27);

  ctx.textAlign = 'left';
  ctx.font = fontStack(9, '600');
  ctx.fillStyle = colors.textMuted;
  ctx.fillText(`${lang === 'bn' ? 'ফোন' : 'PHONE'}: `, padX, curY + 43);
  ctx.fillStyle = colors.textSecondary;
  ctx.font = fontStack(9, 'normal');
  ctx.fillText(customerPhone, padX + 44, curY + 43);

  // Scope Note
  ctx.textAlign = 'left';
  ctx.font = fontStack(8.5, '500');
  ctx.fillStyle = colors.cyan;
  ctx.fillText(
    lang === 'bn' 
      ? `* সর্বশেষ ${safeFormatNumber(displayTxs.length, lang)}টি লেনদেনের বিবরণী` 
      : `* Recent ${displayTxs.length} Transactions Activity`,
    padX,
    curY + 58
  );

  curY += 68;
  drawDashedLine(ctx, curY, padX, width - padX, colors.dashedLine);
  curY += 6;

  // 3. CARRY-FORWARD OPENING BALANCE CALCULATION
  const periodDues = displayTxs
    .filter(tx => tx && tx.type === 'due')
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  const periodPayments = displayTxs
    .filter(tx => tx && tx.type === 'payment')
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  const netPeriodMovement = periodDues - periodPayments;
  const currentBalance = outstandingDue;
  const openingBalance = currentBalance - netPeriodMovement;

  // Opening Balance Row
  ctx.font = fontStack(9, '600');
  ctx.fillStyle = colors.textMuted;
  ctx.textAlign = 'left';
  ctx.fillText(lang === 'bn' ? 'পূর্বের জের (Carried Fwd):' : 'Opening Balance (B/F):', padX, curY + 11);
  ctx.textAlign = 'right';
  ctx.fillStyle = colors.textValue;
  ctx.font = fontStack(9.5, 'bold');
  ctx.fillText(`৳ ${safeFormatNumber(openingBalance, lang)}`, width - padX, curY + 11);

  curY += 24;
  drawDashedLine(ctx, curY, padX, width - padX, colors.dashedLine);
  curY += 6;

  // 4. TABLE HEADER (no background card)
  ctx.font = fontStack(8.5, 'bold');
  ctx.fillStyle = colors.textMuted;

  ctx.textAlign = 'left';
  ctx.fillText(lang === 'bn' ? 'তারিখ ও বিবরণ' : 'DATE & DETAILS', padX, curY + 10);

  ctx.textAlign = 'center';
  ctx.fillText(lang === 'bn' ? 'ধরন' : 'TYPE', padX + contentWidth * 0.54, curY + 10);

  ctx.textAlign = 'right';
  ctx.fillText(lang === 'bn' ? 'টাকা' : 'AMOUNT', width - padX, curY + 10);

  curY += 22;
  drawDashedLine(ctx, curY, padX, width - padX, colors.dashedLine);
  curY += 6;

  // 5. TRANSACTION ROWS
  if (displayTxs.length === 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.textSubtle;
    ctx.font = fontStack(9, 'normal');
    ctx.fillText(lang === 'bn' ? 'কোন লেনদেন নেই' : 'No transactions recorded', width / 2, curY + 18);
    curY += 36;
  } else {
    displayTxs.forEach((tx) => {
      const txDate = parseTxDate(tx.date);
      const rowDateStr = txDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: '2-digit', month: 'short' });
      const rowTimeStr = txDate.toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' });
      const isTxDue = tx.type === 'due';
      const typeLabel = isTxDue ? (lang === 'bn' ? 'বকেয়া' : 'DUE') : (lang === 'bn' ? 'জমা' : 'PAID');
      const sign = isTxDue ? '+' : '-';
      const amountStr = `${sign} ৳${safeFormatNumber(tx.amount, lang)}`;
      const hasDesc = !!tx.description?.trim();
      const rowH = hasDesc ? 42 : 27;

      // Date, Type, Amount
      ctx.textAlign = 'left';
      ctx.fillStyle = colors.textRowDate;
      ctx.font = fontStack(9, 'normal');
      ctx.fillText(`${rowDateStr} ${rowTimeStr}`, padX, curY + 12);

      ctx.textAlign = 'center';
      ctx.fillStyle = isTxDue ? colors.due : colors.paid;
      ctx.font = fontStack(8.5, 'bold');
      ctx.fillText(`[${typeLabel}]`, padX + contentWidth * 0.54, curY + 12);

      ctx.textAlign = 'right';
      ctx.fillStyle = isTxDue ? colors.due : colors.paid;
      ctx.font = fontStack(10, 'bold');
      ctx.fillText(amountStr, width - padX, curY + 12);

      // Sub-line description
      if (hasDesc) {
        const descText = tx.description!.trim();
        const truncatedDesc = descText.length > 32 ? descText.slice(0, 30) + '..' : descText;

        // Draw Lucide 'corner-down-right' icon
        drawCornerDownRight(ctx, padX + 5, curY + 18, 9, colors.textMuted);

        ctx.textAlign = 'left';
        ctx.fillStyle = colors.textMuted;
        ctx.font = fontStack(8.5, 'normal');
        ctx.fillText(truncatedDesc, padX + 17, curY + 27);
      }

      curY += rowH;
    });
  }

  curY += 6;
  drawDashedLine(ctx, curY, padX, width - padX, colors.dashedLine);
  curY += 8;

  // 6. PERIOD TOTALS
  ctx.font = fontStack(9, 'normal');
  ctx.fillStyle = colors.textMuted;
  ctx.textAlign = 'left';
  ctx.fillText(lang === 'bn' ? 'এই সময়ের মোট বকেয়া:' : 'Period Total Dues:', padX, curY + 11);
  ctx.textAlign = 'right';
  ctx.fillStyle = colors.due;
  ctx.font = fontStack(9.5, 'bold');
  ctx.fillText(`+ ৳${safeFormatNumber(periodDues, lang)}`, width - padX, curY + 11);

  ctx.font = fontStack(9, 'normal');
  ctx.fillStyle = colors.textMuted;
  ctx.textAlign = 'left';
  ctx.fillText(lang === 'bn' ? 'এই সময়ের মোট জমা:' : 'Period Total Paid:', padX, curY + 26);
  ctx.textAlign = 'right';
  ctx.fillStyle = colors.paid;
  ctx.font = fontStack(9.5, 'bold');
  ctx.fillText(`- ৳${safeFormatNumber(periodPayments, lang)}`, width - padX, curY + 26);

  ctx.font = fontStack(9, '600');
  ctx.fillStyle = colors.textSecondary;
  ctx.textAlign = 'left';
  ctx.fillText(lang === 'bn' ? 'এই সময়ের নিট পরিবর্তন:' : 'Period Net Change:', padX, curY + 41);
  ctx.textAlign = 'right';
  ctx.fillStyle = netPeriodMovement >= 0 ? colors.due : colors.paid;
  ctx.font = fontStack(9.5, 'bold');
  ctx.fillText(`${netPeriodMovement >= 0 ? '+' : '-'} ৳${safeFormatNumber(Math.abs(netPeriodMovement), lang)}`, width - padX, curY + 41);

  curY += 52;
  drawDoubleLine(ctx, curY, padX, width - padX, colors.doubleLine);
  curY += 10;

  // 7. CURRENT BALANCE (no background card)
  const isSettled = outstandingDue === 0;
  const isDue = outstandingDue > 0;

  let statusColor = colors.due;
  let statusText = lang === 'bn' ? 'বকেয়া রয়েছে' : 'OUTSTANDING DUE';

  if (isSettled) {
    statusColor = colors.paid;
    statusText = lang === 'bn' ? 'সম্পূর্ণ পরিশোধিত' : 'FULLY SETTLED';
  } else if (!isDue) {
    statusColor = colors.cyan;
    statusText = lang === 'bn' ? 'অগ্রিম জমা' : 'CREDIT SURPLUS';
  }

  const balanceDisplay = isSettled
    ? '৳ 0'
    : `${outstandingDue < 0 ? '- ' : ''}৳ ${safeFormatNumber(Math.abs(outstandingDue), lang)}`;

  ctx.textAlign = 'left';
  ctx.font = fontStack(9, 'bold');
  ctx.fillStyle = colors.textMuted;
  ctx.fillText(lang === 'bn' ? 'সর্বশেষ মোট স্থিতি:' : 'CURRENT BALANCE:', padX, curY + 11);

  ctx.textAlign = 'right';
  ctx.font = fontStack(8.5, 'bold');
  ctx.fillStyle = statusColor;
  ctx.fillText(`[ ${statusText} ]`, width - padX, curY + 11);

  // Large crisp balance
  ctx.textAlign = 'center';
  ctx.font = fontStack(22, '800');
  ctx.fillStyle = statusColor;
  ctx.fillText(balanceDisplay, width / 2, curY + 36);

  curY += 48;
  drawDashedLine(ctx, curY, padX, width - padX, colors.dashedLine);
  curY += 8;

  // 8. BARCODE STRIP (No "Thank you" footer text as requested)
  ctx.save();
  const barcodeY = curY;
  const barcodeH = 16;
  const barPattern = [2, 1, 3, 1, 4, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 4];
  const barTotalW = barPattern.reduce((sum, w) => sum + w + 1.2, 0);
  let barCurX = (width - barTotalW) / 2;

  ctx.fillStyle = colors.barcode;
  barPattern.forEach((w) => {
    ctx.fillRect(barCurX, barcodeY, w, barcodeH);
    barCurX += w + 1.2;
  });

  ctx.font = fontStack(8, '600');
  ctx.fillStyle = colors.textSubtle;
  ctx.textAlign = 'center';
  ctx.fillText(`* ${slipNo} *`, width / 2, barcodeY + barcodeH + 12);

  ctx.restore();

  // Export canvas asynchronously off the main thread via canvas.toBlob, then pre-decode
  // the bitmap onto the GPU texture cache before opening the popup modal.
  const exportResult = await new Promise<ReceiptImageResult>((resolve, reject) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((b) => {
        if (b) {
          const dataUrl = URL.createObjectURL(b);
          resolve({ dataUrl, blob: b, fileName });
        } else {
          try {
            const fallbackUrl = canvas.toDataURL('image/png');
            resolve({ dataUrl: fallbackUrl, blob: dataUrlToBlob(fallbackUrl), fileName });
          } catch (fallbackErr) {
            reject(fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr)));
          }
        }
      }, 'image/png');
    } else {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const blob = dataUrlToBlob(dataUrl);
        resolve({ dataUrl, blob, fileName });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    }
  });

  if (typeof Image !== 'undefined') {
    try {
      const preloadImg = new Image();
      preloadImg.decoding = 'async';
      preloadImg.src = exportResult.dataUrl;
      if (typeof preloadImg.decode === 'function') {
        await preloadImg.decode();
      }
    } catch {
      // Non-fatal if decode() is unsupported or interrupted
    }
  }

  return exportResult;
}

/**
 * Triggers download of the generated receipt PNG on user action.
 */
export function downloadReceiptImage(dataUrl: string, fileName: string) {
  try {
    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    }, 200);
  } catch (err) {
    console.warn('downloadReceiptImage error:', err);
  }
}

/**
 * Copies the receipt PNG to the system clipboard (if supported).
 */
export async function copyReceiptImage(blob: Blob): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch (err) {
    console.error('Clipboard copy failed:', err);
  }
  return false;
}

/**
 * Native file share via Web Share API (if supported on mobile/tablet).
 */
export async function shareReceiptImage(blob: Blob, fileName: string, customerName: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && 'canShare' in navigator && typeof File !== 'undefined') {
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Challan Track - ${customerName}`,
          text: `Transaction Receipt for ${customerName}`
        });
        return true;
      }
    }
  } catch (err) {
    if ((err as Error)?.name !== 'AbortError') {
      console.error('Web share failed:', err);
    }
  }
  return false;
}

/**
 * Generates a minimal, text-only bank-statement-style PDF containing ALL billed transactions
 * for a credit card account. Renders onto crisp A4 canvas pages (guaranteeing full Bengali &
 * Taka glyph fidelity) and wraps them into a multi-page A4 PDF via jsPDF.
 */
export async function generateCreditCardStatementPdf(
  customer: Customer,
  billedTransactions: Transaction[] = [],
  meta?: CreditCardStatementMeta | null,
  lang: Language = 'en'
): Promise<CreditCardStatementPdfResult> {
  await ensureReceiptFontsLoaded();

  const customerName = customer?.name?.trim() || (lang === 'bn' ? 'ক্রেডিট কার্ড হিসাব' : 'Credit Card Account');
  const customerPhone = customer?.phone?.trim() || (lang === 'bn' ? 'প্রযোজ্য নয়' : 'N/A');
  const outstandingDue = typeof customer?.outstandingDue === 'number' && !isNaN(customer.outstandingDue)
    ? customer.outstandingDue
    : Number(customer?.outstandingDue) || 0;
  const billingDay = meta?.billingDay || Math.min(31, Math.max(1, customer?.billingDay || 15));

  const cleanPrefix = customerName.replace(/[^\w\u0980-\u09FF]/g, '_').replace(/_+/g, '_').trim() || 'Card';
  const fileName = `${cleanPrefix}_Billed_Statement.pdf`;

  const sortedBilled = [...(Array.isArray(billedTransactions) ? billedTransactions : [])].sort(
    (a, b) => parseTxDate(a.date).getTime() - parseTxDate(b.date).getTime()
  );

  const totalBilledCharges = sortedBilled
    .filter((tx) => tx && tx.type === 'due')
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  const totalBilledCredits = sortedBilled
    .filter((tx) => tx && tx.type === 'payment')
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  const statementBalance = meta?.billedStatementAmount ?? Math.max(0, totalBilledCharges - totalBilledCredits);
  const unpaidBilledDue = meta?.unpaidCarryOver ?? statementBalance;
  const closedOnStr = meta?.lastStatementDate
    ? meta.lastStatementDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : new Date().toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

  const now = new Date();
  const generatedStr = now.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  // A4 layout in logical pt — 4x ultra-high-DPI lossless render for crisp zoom legibility
  const pageW = 595;
  const pageH = 842;
  const scale = 4;
  const padX = 42;
  const rightX = pageW - padX;

  const fontDisplay = (size: number, weight: '500' | '600' | 'bold' = 'bold') => {
    const w = weight === 'bold' ? '700' : weight;
    return `${w} ${size}px "Bricolage Grotesque", "Manrope", "Hind Siliguri", "Noto Sans Bengali", sans-serif`;
  };

  const fontSans = (size: number, weight: 'normal' | '500' | '600' | 'bold' = 'normal') => {
    const w = weight === 'normal' ? '400' : weight === 'bold' ? '700' : weight;
    return `${w} ${size}px "Manrope", "Hind Siliguri", "Noto Sans Bengali", -apple-system, sans-serif`;
  };

  const fontMono = (size: number, weight: 'normal' | '500' | '600' | 'bold' = 'normal') => {
    const w = weight === 'normal' ? '400' : weight === 'bold' ? '700' : weight;
    return `${w} ${size}px "Geist Mono", "Hind Siliguri", ui-monospace, monospace`;
  };

  const setTracking = (ctx: CanvasRenderingContext2D, spacing: string) => {
    if ('letterSpacing' in ctx) {
      (ctx as any).letterSpacing = spacing;
    }
  };

  // Pure monochrome editorial ink palette (no colors, no text boxes)
  const inkPrimary = '#09090B';
  const inkSecondary = '#3F3F46';
  const inkMuted = '#71717A';
  const hairline = '#E4E4E7';
  const rowHairline = '#F1F1F4';
  const anchorRule = '#18181B';

  const pages: HTMLCanvasElement[] = [];

  const createPageCanvas = () => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(pageW * scale);
    canvas.height = Math.round(pageH * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is not available');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.scale(scale, scale);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, pageW, pageH);
    pages.push(canvas);
    return ctx;
  };

  const drawRule = (ctx: CanvasRenderingContext2D, y: number, color = hairline, lineWidth = 0.75) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(rightX, y);
    ctx.stroke();
    ctx.restore();
  };

  const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] => {
    const clean = text.trim();
    if (!clean) return ['—'];
    const words = clean.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxW) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines.slice(0, 2);
  };

  const maskedAccNo = (customer?.id ? customer.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 9).toUpperCase() : '123567744').padEnd(9, '0');

  // Dates
  const startDate = sortedBilled.length > 0 ? parseTxDate(sortedBilled[0].date) : (meta?.lastStatementDate || now);
  const endDate = sortedBilled.length > 0 ? parseTxDate(sortedBilled[sortedBilled.length - 1].date) : now;
  const startDateNumStr = `${startDate.getMonth() + 1}/${startDate.getDate()}/${startDate.getFullYear()}`;
  const endDateNumStr = `${endDate.getMonth() + 1}/${endDate.getDate()}/${endDate.getFullYear()}`;
  const monthYearStr = endDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'long', year: 'numeric' });

  // Cleanly balanced columns for legible 10pt-10.5pt entries
  const colDateX = padX;
  const colDescX = padX + 78;
  const colDescMaxW = 204;
  const colAmountX = padX + 368;
  const colFeesX = padX + 434;
  const colTotalX = rightX;

  const uniqueBillerId = customer?.id
    ? `CARD-ID-${customer.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase()}`
    : 'CARD-ID-8472910384';

  const drawBarcode = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, codeStr: string) => {
    ctx.save();
    ctx.fillStyle = inkPrimary;
    let seed = 0;
    for (let i = 0; i < codeStr.length; i++) {
      seed = (seed * 31 + codeStr.charCodeAt(i)) & 0xffffffff;
    }
    const numBars = 36;
    const barUnit = w / (numBars * 1.55);
    let curX = x;
    for (let i = 0; i < numBars; i++) {
      const isThick = ((seed >> (i % 22)) ^ (i * 5)) % 3 === 0;
      const bW = isThick ? barUnit * 1.55 : barUnit * 0.8;
      ctx.fillRect(curX, y, bW, h);
      curX += bW + barUnit * 0.7;
      if (curX > x + w) break;
    }
    ctx.restore();
  };

  const drawPageHeader = (ctx: CanvasRenderingContext2D) => {
    // Architectural monochrome masthead hairline
    drawRule(ctx, 36, anchorRule, 1.4);

    // 1. Top Left: "Account Statement" modern geometric display title
    ctx.save();
    setTracking(ctx, '-0.5px');
    ctx.fillStyle = inkPrimary;
    ctx.font = fontDisplay(22, 'bold');
    ctx.textAlign = 'left';
    ctx.fillText(lang === 'bn' ? 'অ্যাকাউন্ট স্টেটমেন্ট' : 'Account Statement', padX, 68);
    ctx.restore();

    // ACCOUNT label & value
    ctx.save();
    setTracking(ctx, '0.9px');
    ctx.fillStyle = inkMuted;
    ctx.font = fontMono(8, '600');
    ctx.textAlign = 'left';
    ctx.fillText(lang === 'bn' ? 'হিসাব' : 'ACCOUNT', padX, 98);
    ctx.restore();

    ctx.fillStyle = inkPrimary;
    ctx.font = fontSans(10.5, '600');
    ctx.textAlign = 'left';
    ctx.fillText(`${customerName}  ·  ${maskedAccNo}`, padX, 113);

    // PERIOD label & value
    ctx.save();
    setTracking(ctx, '0.9px');
    ctx.fillStyle = inkMuted;
    ctx.font = fontMono(8, '600');
    ctx.fillText(lang === 'bn' ? 'সময়কাল' : 'PERIOD', padX, 134);
    ctx.restore();

    ctx.fillStyle = inkPrimary;
    ctx.font = fontMono(10, '500');
    ctx.fillText(`${startDateNumStr} — ${endDateNumStr}`, padX, 149);

    // 2. Top Right: Clean Brand Name + Barcode + Unique Biller ID
    ctx.save();
    ctx.textAlign = 'right';
    setTracking(ctx, '-0.3px');
    ctx.font = fontDisplay(16.5, 'bold');
    ctx.fillStyle = inkPrimary;
    ctx.fillText('ChallanTrack', rightX, 68);
    ctx.restore();

    const barcodeW = 118;
    const barcodeH = 20;
    const barcodeX = rightX - barcodeW;
    const barcodeY = 82;
    drawBarcode(ctx, barcodeX, barcodeY, barcodeW, barcodeH, uniqueBillerId);

    ctx.save();
    setTracking(ctx, '0.5px');
    ctx.textAlign = 'right';
    ctx.font = fontMono(8, 'normal');
    ctx.fillStyle = inkMuted;
    ctx.fillText(uniqueBillerId, rightX, barcodeY + barcodeH + 12);
    ctx.restore();

    drawRule(ctx, 166, hairline, 0.75);
  };

  const drawSummarySection = (ctx: CanvasRenderingContext2D, startY: number) => {
    ctx.save();
    setTracking(ctx, '-0.25px');
    ctx.fillStyle = inkPrimary;
    ctx.font = fontDisplay(14, 'bold');
    ctx.textAlign = 'left';
    ctx.fillText(lang === 'bn' ? 'সারসংক্ষেপ' : 'Summary', padX, startY);
    ctx.restore();

    drawRule(ctx, startY + 10, anchorRule, 1);

    const hdrY = startY + 25;
    ctx.save();
    setTracking(ctx, '0.9px');
    ctx.fillStyle = inkMuted;
    ctx.font = fontMono(8, '600');
    ctx.textAlign = 'left';
    ctx.fillText(lang === 'bn' ? 'সময়কাল' : 'PERIOD', padX, hdrY);

    ctx.textAlign = 'right';
    ctx.fillText(lang === 'bn' ? 'প্রারম্ভিক স্থিতি' : 'OPENING BALANCE', padX + 340, hdrY);
    ctx.fillText(lang === 'bn' ? 'সমাপনী স্থিতি' : 'CLOSING BALANCE', rightX, hdrY);
    ctx.restore();

    drawRule(ctx, hdrY + 7, hairline, 0.5);

    const rowY = hdrY + 26;
    ctx.fillStyle = inkPrimary;
    ctx.textAlign = 'left';
    ctx.font = fontSans(11, '600');
    ctx.fillText(monthYearStr, padX, rowY);

    ctx.textAlign = 'right';
    ctx.font = fontMono(12, '600');
    ctx.fillText(`৳${safeFormatNumber(unpaidBilledDue, lang)}`, padX + 340, rowY);
    ctx.font = fontMono(12, 'bold');
    ctx.fillText(`৳${safeFormatNumber(statementBalance, lang)}`, rightX, rowY);

    drawRule(ctx, rowY + 13, hairline, 0.75);

    return rowY + 38;
  };

  const drawTransactionsHeader = (ctx: CanvasRenderingContext2D, startY: number) => {
    ctx.save();
    setTracking(ctx, '-0.25px');
    ctx.fillStyle = inkPrimary;
    ctx.font = fontDisplay(14, 'bold');
    ctx.textAlign = 'left';
    ctx.fillText(lang === 'bn' ? 'লেনদেনসমূহ' : 'Transactions', padX, startY);
    ctx.restore();

    drawRule(ctx, startY + 10, anchorRule, 1);

    const hdrY = startY + 25;
    ctx.save();
    setTracking(ctx, '0.9px');
    ctx.fillStyle = inkMuted;
    ctx.font = fontMono(8, '600');

    ctx.textAlign = 'left';
    ctx.fillText(lang === 'bn' ? 'তারিখ' : 'DATE', colDateX, hdrY);
    ctx.fillText(lang === 'bn' ? 'বিবরণ' : 'DESCRIPTION', colDescX, hdrY);

    ctx.textAlign = 'right';
    ctx.fillText(lang === 'bn' ? 'পরিমাণ' : 'AMOUNT', colAmountX, hdrY);
    ctx.fillText(lang === 'bn' ? 'ফি' : 'FEES', colFeesX, hdrY);
    ctx.fillText(lang === 'bn' ? 'মোট' : 'TOTAL', colTotalX, hdrY);
    ctx.restore();

    drawRule(ctx, hdrY + 7, hairline, 0.5);

    return hdrY + 16;
  };

  // Page 1 Setup
  let ctx = createPageCanvas();
  drawPageHeader(ctx);

  let curY = 192;
  curY = drawSummarySection(ctx, curY);
  curY = drawTransactionsHeader(ctx, curY);

  if (sortedBilled.length === 0) {
    ctx.textAlign = 'center';
    ctx.font = fontSans(10.5, '500');
    ctx.fillStyle = inkMuted;
    ctx.fillText(
      lang === 'bn'
        ? 'বিলিং দিনে স্থানান্তরিত কোনো বিল্ড লেনদেন পাওয়া যায়নি।'
        : 'No billed transactions moved into statement yet.',
      pageW / 2,
      curY + 30
    );
    curY += 56;
  } else {
    sortedBilled.forEach((tx, rowIdx) => {
      const txDate = parseTxDate(tx.date);
      const dateStr = `${txDate.getMonth() + 1}/${txDate.getDate()}/${txDate.getFullYear()}`;
      const isDue = tx.type === 'due';

      const rawDesc =
        tx.description?.trim() ||
        (isDue
          ? (lang === 'bn' ? 'কার্ড খরচ' : 'Purchase')
          : (lang === 'bn' ? 'কার্ড জমা' : 'Deposit'));

      ctx.font = fontSans(10.5, '500');
      const descLines = wrapLines(ctx, rawDesc, colDescMaxW);
      const rowH = descLines.length > 1 ? 37 : 24;

      if (curY + rowH > pageH - 108) {
        ctx = createPageCanvas();
        drawPageHeader(ctx);
        curY = drawTransactionsHeader(ctx, 192);
      }

      if (rowIdx > 0 && curY > 210) {
        drawRule(ctx, curY - 2, rowHairline, 0.5);
      }

      const baselineY = curY + 14;

      // Date (Geist Mono)
      ctx.textAlign = 'left';
      ctx.font = fontMono(9.75, 'normal');
      ctx.fillStyle = inkSecondary;
      ctx.fillText(dateStr, colDateX, baselineY);

      // Description (Manrope)
      ctx.font = fontSans(10.5, '500');
      ctx.fillStyle = inkPrimary;
      descLines.forEach((line, lineIdx) => {
        ctx.fillText(line, colDescX, baselineY + lineIdx * 13.5);
      });

      // Amount (Geist Mono)
      const amountPrefix = isDue ? '-৳' : '৳';
      const amountStr = `${amountPrefix}${safeFormatNumber(tx.amount, lang)}`;
      ctx.textAlign = 'right';
      ctx.font = fontMono(10, '500');
      ctx.fillStyle = inkPrimary;
      ctx.fillText(amountStr, colAmountX, baselineY);

      // Fees (Geist Mono)
      ctx.fillStyle = inkSecondary;
      ctx.fillText('৳0.00', colFeesX, baselineY);

      // Total (Geist Mono)
      ctx.font = fontMono(10, '600');
      ctx.fillStyle = inkPrimary;
      ctx.fillText(amountStr, colTotalX, baselineY);

      curY += rowH;
    });

    // Sub-row: MONTHLY TOTALS
    drawRule(ctx, curY + 4, anchorRule, 0.9);
    curY += 20;

    ctx.save();
    setTracking(ctx, '0.8px');
    ctx.textAlign = 'left';
    ctx.font = fontMono(8.25, 'bold');
    ctx.fillStyle = inkMuted;
    ctx.fillText(lang === 'bn' ? 'মাসিক সর্বমোট' : 'MONTHLY TOTALS', padX, curY);
    ctx.restore();

    const netAmount = totalBilledCharges - totalBilledCredits;
    ctx.textAlign = 'right';
    ctx.font = fontMono(10.25, 'bold');
    ctx.fillStyle = inkPrimary;
    ctx.fillText(`৳${safeFormatNumber(Math.abs(netAmount), lang)}`, colAmountX, curY);
    ctx.fillText('৳0.00', colFeesX, curY);
    ctx.fillText(`৳${safeFormatNumber(statementBalance, lang)}`, colTotalX, curY);

    drawRule(ctx, curY + 10, hairline, 0.75);
  }

  // Stamp footer and disclaimer on all pages
  const totalPages = pages.length;
  pages.forEach((canvas, idx) => {
    const pCtx = canvas.getContext('2d');
    if (!pCtx) return;

    pCtx.save();

    const disclaimerY = pageH - 60;
    pCtx.font = fontSans(8.5, 'normal');
    pCtx.fillStyle = inkMuted;
    pCtx.textAlign = 'left';
    pCtx.fillText(
      lang === 'bn'
        ? 'এটি একটি কম্পিউটার-জেনারেটেড স্টেটমেন্ট। এতে কোনো স্বাক্ষর বা অনুমোদনের প্রয়োজন নেই।'
        : 'This is a computer-generated document. No signature or physical authentication is required.',
      padX,
      disclaimerY
    );

    drawRule(pCtx, pageH - 44, hairline, 0.65);

    pCtx.font = fontDisplay(10, 'bold');
    pCtx.fillStyle = inkPrimary;
    pCtx.textAlign = 'left';
    pCtx.fillText('ChallanTrack', padX, pageH - 28);

    pCtx.font = fontMono(8.5, 'normal');
    pCtx.fillStyle = inkMuted;
    pCtx.textAlign = 'right';
    pCtx.fillText(
      lang === 'bn'
        ? `পৃষ্ঠা ${safeFormatNumber(idx + 1, 'bn')} / ${safeFormatNumber(totalPages, 'bn')}`
        : `Page ${idx + 1} of ${totalPages}`,
      rightX,
      pageH - 28
    );
    pCtx.restore();
  });

  // Assemble ultra-sharp lossless PNG PDF + crisp preview URLs
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const previewPages: string[] = [];
  for (let i = 0; i < pages.length; i++) {
    const canvas = pages[i];
    if (i > 0) doc.addPage();
    const pngData = canvas.toDataURL('image/png');
    doc.addImage(pngData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');

    const pageUrl = await new Promise<string>((resolve) => {
      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob(
          (b) => {
            if (b) {
              resolve(URL.createObjectURL(b));
            } else {
              resolve(pngData);
            }
          },
          'image/png'
        );
      } else {
        resolve(pngData);
      }
    });
    previewPages.push(pageUrl);
  }

  const pdfBlob = doc.output('blob');

  // Build plain-text statement summary for clipboard copy
  const textLines: string[] = [
    `CHALLAN TRACK — CREDIT CARD BILLED STATEMENT`,
    `Account: ${customerName}${customerPhone !== 'N/A' ? ` (${customerPhone})` : ''}`,
    `Statement Date: ${generatedStr} | Closed On: ${closedOnStr} | Billing Day: ${billingDay}`,
    `Billed Entries: ${sortedBilled.length}`,
    `Total Billed Debits: ৳${safeFormatNumber(totalBilledCharges, lang)}`,
    `Total Billed Credits: ৳${safeFormatNumber(totalBilledCredits, lang)}`,
    `Unpaid Billed Due: ৳${safeFormatNumber(unpaidBilledDue, lang)}`,
    `Total Card Balance: ${outstandingDue < 0 ? '-' : ''}৳${safeFormatNumber(Math.abs(outstandingDue), lang)}`,
    `----------------------------------------`,
    ...sortedBilled.map((tx) => {
      const d = parseTxDate(tx.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
      const sign = tx.type === 'due' ? '+' : '-';
      const desc = tx.description?.trim() || (tx.type === 'due' ? 'Card Charge' : 'Card Payment');
      return `${d} | ${desc} | ${sign}৳${safeFormatNumber(tx.amount, lang)}`;
    }),
    `----------------------------------------`
  ];

  return {
    kind: 'pdf',
    blob: pdfBlob,
    fileName,
    previewPages,
    plainTextSummary: textLines.join('\n'),
    billedCount: sortedBilled.length
  };
}

/**
 * Triggers download of a generated PDF Blob.
 */
export function downloadReceiptPdf(blob: Blob, fileName: string) {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = fileName;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (link.parentNode) link.parentNode.removeChild(link);
      try { URL.revokeObjectURL(url); } catch {}
    }, 500);
  } catch (err) {
    console.warn('downloadReceiptPdf error:', err);
  }
}

/**
 * Copies plain-text bank statement summary to the clipboard.
 */
export async function copyPlainTextReceipt(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.error('Text clipboard copy failed:', err);
  }
  return false;
}

/**
 * Native file share for PDF receipt via Web Share API.
 */
export async function shareReceiptPdf(blob: Blob, fileName: string, customerName: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && 'canShare' in navigator && typeof File !== 'undefined') {
      const file = new File([blob], fileName, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Challan Track - ${customerName} Statement`,
          text: `Credit Card Billed Statement PDF for ${customerName}`
        });
        return true;
      }
    }
  } catch (err) {
    if ((err as Error)?.name !== 'AbortError') {
      console.error('Web share PDF failed:', err);
    }
  }
  return false;
}
