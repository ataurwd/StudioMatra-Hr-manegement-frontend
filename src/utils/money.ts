/**
 * STUDIO MATRA — Decimal-Safe BDT Currency & Arithmetic Utility
 * Ensures all monetary operations use exact 2-decimal rounded arithmetic
 * without JavaScript floating-point representation drift.
 */

export const BDT_SYMBOL = '৳';

/**
 * Rounds a number to exactly two decimal places using half-up method.
 */
export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Adds numbers with 2-decimal precision.
 */
export function addMoney(...amounts: number[]): number {
  const sum = amounts.reduce((acc, curr) => acc + (curr || 0), 0);
  return round2(sum);
}

/**
 * Subtracts b from a with 2-decimal precision.
 */
export function subtractMoney(a: number, b: number): number {
  return round2((a || 0) - (b || 0));
}

/**
 * Multiplies an amount by quantity/rate with 2-decimal precision.
 */
export function multiplyMoney(amount: number, factor: number): number {
  return round2((amount || 0) * (factor || 0));
}

/**
 * Divides amount by divisor with 2-decimal precision.
 * Returns 0 if divisor is 0.
 */
export function divideMoney(amount: number, divisor: number): number {
  if (!divisor || divisor === 0) return 0;
  return round2((amount || 0) / divisor);
}

/**
 * Formats a numeric value into Bangladeshi Taka string format.
 * Example: 75000 -> "৳ 75,000.00"
 */
export function formatBDT(amount: number, includeDecimals = true): string {
  const safeAmount = round2(amount || 0);
  const parts = safeAmount.toFixed(includeDecimals ? 2 : 0).split('.');
  
  // Format with South Asian numbering system if preferred or standard comma grouping
  let integerPart = parts[0];
  const decimalPart = parts[1];
  
  // South Asian formatting: last 3 digits, then pairs of 2
  const isNegative = integerPart.startsWith('-');
  if (isNegative) {
    integerPart = integerPart.slice(1);
  }

  let lastThree = integerPart.slice(-3);
  const otherNumbers = integerPart.slice(0, -3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInteger = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
  const signed = (isNegative ? '-' : '') + formattedInteger;

  return includeDecimals ? `৳ ${signed}.${decimalPart}` : `৳ ${signed}`;
}

/**
 * Converts a number into English words for formal payslip text.
 * e.g. 75,000 -> "Seventy-Five Thousand Bangladeshi Taka Only"
 */
export function numberToWordsBDT(amount: number): string {
  const safe = Math.floor(Math.abs(amount));
  if (safe === 0) return 'Zero Taka Only';

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertChunk(n: number): string {
    let str = '';
    if (n >= 100) {
      str += units[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += units[n] + ' ';
    }
    return str.trim();
  }

  // South Asian scales: Crore (10,000,000), Lakh (100,000), Thousand (1,000), Hundred
  let remaining = safe;
  let result = '';

  const crore = Math.floor(remaining / 10000000);
  remaining %= 10000000;
  if (crore > 0) {
    result += convertChunk(crore) + ' Crore ';
  }

  const lakh = Math.floor(remaining / 100000);
  remaining %= 100000;
  if (lakh > 0) {
    result += convertChunk(lakh) + ' Lakh ';
  }

  const thousand = Math.floor(remaining / 1000);
  remaining %= 1000;
  if (thousand > 0) {
    result += convertChunk(thousand) + ' Thousand ';
  }

  if (remaining > 0) {
    result += convertChunk(remaining);
  }

  const paisa = Math.round((Math.abs(amount) - safe) * 100);
  let finalStr = result.trim() + ' Taka';
  if (paisa > 0) {
    finalStr += ` and ${convertChunk(paisa)} Paisa`;
  }

  return finalStr + ' Only';
}
