/**
 * Parser — Receipt Text Extraction Engine
 * 
 * Converts raw OCR text into structured expense fields.
 * Handles mixed Indonesian + English receipts with smart category detection.
 */

// ─── Category Keyword Maps ──────────────────────────────────────────

const MERCHANT_CATEGORIES = {
  'Food & Beverage': [
    'starbucks', 'kopi', 'cafe', 'coffee', 'mcd', 'mcdonald', 'burger', 'pizza',
    'bakmi', 'warung', 'resto', 'restoran', 'restaurant', 'sushi', 'ramen',
    'nasi', 'sate', 'martabak', 'jco', 'dunkin', 'kfc', 'richeese', 'hokben',
    'yoshinoya', 'pepper lunch', 'chatime', 'xing fu tang', 'haus', 'janji jiwa',
  ],
  'Groceries': [
    'indomaret', 'alfamart', 'superindo', 'giant', 'hypermart', 'carrefour',
    'lotte', 'ranch market', 'farmers market', 'food hall', 'transmart',
    'hero', 'hari hari', 'toko', 'minimarket',
  ],
  'Health': [
    'apotik', 'apotek', 'pharmacy', 'kimia farma', 'guardian', 'watsons',
    'century', 'klinik', 'clinic', 'rumah sakit', 'hospital', 'lab',
  ],
  'Transportation': [
    'grab', 'gojek', 'uber', 'parkir', 'parking', 'tol', 'toll',
    'pertamina', 'shell', 'spbu', 'vivo', 'bp', 'total energies',
    'transjakarta', 'mrt', 'lrt', 'kereta', 'train', 'bus',
  ],
  'Shopping': [
    'tokopedia', 'shopee', 'lazada', 'blibli', 'bukalapak', 'zalora',
    'uniqlo', 'h&m', 'zara', 'miniso', 'daiso', 'ace hardware',
  ],
  'Utilities': [
    'pln', 'pdam', 'telkom', 'indihome', 'listrik', 'air', 'internet',
    'wifi', 'pulsa', 'token',
  ],
  'Entertainment': [
    'cinema', 'bioskop', 'cgv', 'xxi', 'cinepolis', 'spotify', 'netflix',
    'youtube', 'game', 'karaoke',
  ],
};

const ITEM_CATEGORIES = {
  'Groceries': [
    'beras', 'minyak', 'telur', 'sayur', 'buah', 'susu', 'roti', 'mentega',
    'gula', 'garam', 'tepung', 'kecap', 'sambal', 'sabun', 'detergen',
    'shampoo', 'tissue', 'pasta gigi', 'sikat gigi', 'pampers', 'popok',
    'mie instan', 'indomie', 'sedaap', 'snack', 'kerupuk', 'terigu',
  ],
  'Health': [
    'obat', 'vitamin', 'paracetamol', 'amoxicillin', 'salep', 'plester',
    'masker', 'antiseptik', 'ibuprofen', 'antangin', 'tolak angin',
    'minyak kayu putih', 'betadine',
  ],
  'Food & Beverage': [
    'kopi', 'teh', 'nasi', 'mie', 'ayam', 'sapi', 'ikan', 'udang',
    'soto', 'bakso', 'gado', 'pecel', 'rendang', 'gulai', 'sate',
    'es teh', 'es jeruk', 'juice', 'smoothie', 'latte', 'cappuccino',
  ],
};

// ─── Parsing Helpers ─────────────────────────────────────────────────

const INDONESIAN_MONTHS = {
  jan: '01', feb: '02', mar: '03', apr: '04', mei: '05', may: '05',
  jun: '06', jul: '07', agu: '08', ags: '08', aug: '08',
  sep: '09', okt: '10', oct: '10', nov: '11', des: '12', dec: '12',
};

/**
 * Normalize currency string to a plain number.
 * Handles: Rp 50.000, Rp50,000.00, IDR 50000, 50.000,00
 */
function normalizeCurrency(str) {
  if (!str) return null;

  // Remove currency prefixes
  let cleaned = str.replace(/^[\s]*(Rp\.?|IDR|RP)[\s.]*/i, '').trim();

  // Handle Indonesian format: 50.000 or 50.000,00
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
  // Handle international format: 50,000 or 50,000.00
  else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, '');
  }
  // Handle simple comma decimal: 50000,00
  else if (/^\d+,\d{1,2}$/.test(cleaned)) {
    cleaned = cleaned.replace(',', '.');
  }

  // Remove any remaining non-numeric chars except decimal point
  cleaned = cleaned.replace(/[^\d.]/g, '');

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Extract and normalize a date from text.
 * Handles: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD MMM YYYY, etc.
 */
function extractDate(text) {
  const lines = text.split('\n');

  for (const line of lines) {
    // YYYY-MM-DD
    const isoMatch = line.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    // DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = line.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      return `${dmyMatch[3]}-${month}-${day}`;
    }

    // DD/MM/YY
    const dmyShortMatch = line.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})(?!\d)/);
    if (dmyShortMatch) {
      const day = dmyShortMatch[1].padStart(2, '0');
      const month = dmyShortMatch[2].padStart(2, '0');
      const year = parseInt(dmyShortMatch[3]) > 50 ? `19${dmyShortMatch[3]}` : `20${dmyShortMatch[3]}`;
      return `${year}-${month}-${day}`;
    }

    // DD MMM YYYY or DD-MMM-YYYY (Indonesian/English month names)
    const monthNameMatch = line.match(/(\d{1,2})[\s\-]+([A-Za-z]{3,})[\s\-]+(\d{4})/);
    if (monthNameMatch) {
      const day = monthNameMatch[1].padStart(2, '0');
      const monthStr = monthNameMatch[2].toLowerCase().slice(0, 3);
      const monthNum = INDONESIAN_MONTHS[monthStr];
      if (monthNum) {
        return `${monthNameMatch[3]}-${monthNum}-${day}`;
      }
    }
  }

  return null;
}

/**
 * Extract a monetary amount near a keyword.
 */
function extractAmountNearKeyword(text, keywords) {
  const lines = text.split('\n');

  for (const keyword of keywords) {
    for (const line of lines) {
      if (line.toLowerCase().includes(keyword.toLowerCase())) {
        // Look for amounts on the same line
        const amounts = line.match(/[\d.,]+[\d]/g);
        if (amounts && amounts.length > 0) {
          // Take the last amount on the line (usually the value, not qty)
          const normalized = normalizeCurrency(amounts[amounts.length - 1]);
          if (normalized && normalized > 0) {
            return normalized;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Extract merchant name from the first few lines of receipt text.
 */
function extractMerchant(text) {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);

  // Skip very short lines (often just symbols or dates)
  // Take the first substantial line as merchant name
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    // Skip lines that are mostly numbers, dates, or too short
    if (line.length < 3) continue;
    if (/^\d+[\/\-]\d+[\/\-]\d+/.test(line)) continue; // Date-like
    if (/^[\d\s\.\,\-\+\=\*]+$/.test(line)) continue; // All numbers
    if (/^(receipt|struk|nota|invoice|bon|kwitansi|kasir)/i.test(line)) continue;

    // Clean up common receipt artifacts
    return line.replace(/[\*\#\=\-]{2,}/g, '').trim();
  }

  return 'Unknown Merchant';
}

/**
 * Extract payment method from receipt text.
 */
function extractPaymentMethod(text) {
  const lowerText = text.toLowerCase();
  const methods = [
    { keywords: ['qris'], name: 'QRIS' },
    { keywords: ['gopay'], name: 'GoPay' },
    { keywords: ['ovo'], name: 'OVO' },
    { keywords: ['dana'], name: 'DANA' },
    { keywords: ['shopeepay', 'shopee pay'], name: 'ShopeePay' },
    { keywords: ['credit card', 'kartu kredit', 'credit'], name: 'Credit Card' },
    { keywords: ['debit card', 'kartu debit', 'debit'], name: 'Debit Card' },
    { keywords: ['tunai', 'cash', 'kas'], name: 'Cash' },
    { keywords: ['transfer', 'tf'], name: 'Transfer' },
  ];

  for (const method of methods) {
    for (const kw of method.keywords) {
      if (lowerText.includes(kw)) return method.name;
    }
  }

  return '';
}

/**
 * Detect category using 2-tier smart detection.
 * Tier 1: Merchant keyword match
 * Tier 2: Item-content scan
 */
function detectCategory(merchantName, fullText) {
  const lowerMerchant = (merchantName || '').toLowerCase();
  const lowerText = fullText.toLowerCase();

  // Tier 1: Merchant-based
  for (const [category, keywords] of Object.entries(MERCHANT_CATEGORIES)) {
    for (const kw of keywords) {
      if (lowerMerchant.includes(kw)) return category;
    }
  }

  // Tier 2: Item-content scan
  const categoryScores = {};
  for (const [category, keywords] of Object.entries(ITEM_CATEGORIES)) {
    let score = 0;
    for (const kw of keywords) {
      if (lowerText.includes(kw)) score++;
    }
    if (score > 0) categoryScores[category] = score;
  }

  // Return category with highest score
  if (Object.keys(categoryScores).length > 0) {
    const best = Object.entries(categoryScores).sort((a, b) => b[1] - a[1])[0];
    if (best[1] >= 2) return best[0]; // Need at least 2 keyword hits for confidence
  }

  return 'UNCATEGORIZED';
}

// ─── Main Parser ─────────────────────────────────────────────────────

/**
 * Parse raw OCR text into structured expense fields.
 * @param {string} rawText - Full OCR text from the receipt
 * @returns {Object} Parsed fields with confidence score
 */
export function parseReceipt(rawText) {
  if (!rawText || rawText.trim().length === 0) {
    return {
      merchant_name: 'Unknown Merchant',
      transaction_date: '',
      total_amount: '',
      tax_amount: '',
      service_charge: '',
      payment_method: '',
      category: 'UNCATEGORIZED',
      confidence_score: 0,
      raw_ocr_text: rawText || '',
      status: 'NEEDS_REVIEW',
    };
  }

  const merchantName = extractMerchant(rawText);
  const transactionDate = extractDate(rawText);
  const totalAmount = extractAmountNearKeyword(rawText, [
    'grand total', 'total', 'amount due', 'jumlah', 'bayar', 'total bayar',
    'total pembayaran', 'total harga', 'nett', 'net amount',
  ]);
  const taxAmount = extractAmountNearKeyword(rawText, [
    'ppn', 'tax', 'vat', 'pajak', 'pb1',
  ]);
  const serviceCharge = extractAmountNearKeyword(rawText, [
    'service charge', 'service', 'sc', 'biaya layanan', 'biaya service',
  ]);
  const paymentMethod = extractPaymentMethod(rawText);
  const category = detectCategory(merchantName, rawText);

  // Calculate confidence score
  let confidence = 0;
  if (totalAmount) confidence += 0.35;
  if (merchantName && merchantName !== 'Unknown Merchant') confidence += 0.20;
  if (transactionDate) confidence += 0.20;
  if (taxAmount) confidence += 0.05;
  if (serviceCharge) confidence += 0.05;
  if (paymentMethod) confidence += 0.05;
  if (category !== 'UNCATEGORIZED') confidence += 0.10;

  const status = confidence >= 0.5 ? 'CONFIRMED' : 'NEEDS_REVIEW';

  return {
    merchant_name: merchantName,
    transaction_date: transactionDate || '',
    total_amount: totalAmount || '',
    tax_amount: taxAmount || '',
    service_charge: serviceCharge || '',
    payment_method: paymentMethod,
    category,
    confidence_score: Math.round(confidence * 100) / 100,
    raw_ocr_text: rawText,
    status,
  };
}
