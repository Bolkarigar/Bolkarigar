/**
 * Bank statement CSV — India formats, skip metadata rows, safe amounts.
 */

const MAX_BANK_AMOUNT = 50_000_000_000; // ₹500 crore cap per line
const MIN_TXN_YEAR = 1990;
const MAX_TXN_YEAR = 2100;

const MONTH_NAMES = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11
};

function stripBom(text) {
  return String(text || '').replace(/^\uFEFF/, '');
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === ',' && !inQ) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out.map((cell) => cell.replace(/^"|"$/g, '').trim());
}

function validCalendarDate(dt) {
  if (!dt || Number.isNaN(dt.getTime())) return false;
  const y = dt.getFullYear();
  return y >= MIN_TXN_YEAR && y <= MAX_TXN_YEAR;
}

function parseBankStatementDate(raw) {
  const s = String(raw || '').trim().replace(/^"|"$/g, '');
  if (!s || /^date$/i.test(s)) return null;
  if (/^\d{10,}$/.test(s.replace(/[\s,]/g, ''))) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (validCalendarDate(dt) && dt.getDate() === d) return dt;
  }

  const dmY = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmY) {
    const day = parseInt(dmY[1], 10);
    const month = parseInt(dmY[2], 10) - 1;
    let year = parseInt(dmY[3], 10);
    if (year < 100) year += 2000;
    const dt = new Date(year, month, day);
    if (validCalendarDate(dt) && dt.getDate() === day && dt.getMonth() === month) return dt;
  }

  const dMonY = s.match(/^(\d{1,2})[\s\-\/]+([A-Za-z]{3,9})[\s\-\/]+(\d{2,4})$/);
  if (dMonY) {
    const day = parseInt(dMonY[1], 10);
    const monKey = dMonY[2].toLowerCase();
    const month = MONTH_NAMES[monKey];
    if (month !== undefined) {
      let year = parseInt(dMonY[3], 10);
      if (year < 100) year += 2000;
      const dt = new Date(year, month, day);
      if (validCalendarDate(dt) && dt.getDate() === day) return dt;
    }
  }

  const parsed = new Date(s);
  if (validCalendarDate(parsed)) return parsed;
  return null;
}

function parseAmount(raw) {
  if (raw === undefined || raw === null || raw === '') return 0;
  const str = String(raw).trim();
  if (!str || str === '-' || str === '—' || str === 'NA') return 0;
  if (/e[\+\-]/i.test(str)) return 0;

  const digitsOnly = str.replace(/[^\d]/g, '');
  if (digitsOnly.length > 12) return 0;

  let cleaned = str.replace(/[₹\s]/g, '').replace(/,/g, '');
  if (!/^-?\d{1,12}(\.\d{1,2})?$/.test(cleaned)) {
    const m = str.match(/(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d{1,12}(?:\.\d{1,2})?)/);
    if (!m) return 0;
    cleaned = m[1].replace(/,/g, '');
  }
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_BANK_AMOUNT) return 0;
  return Math.round(n * 100) / 100;
}

function headerMatches(cell, aliases) {
  const h = String(cell || '').toLowerCase().trim();
  return aliases.some((a) => h === a || h.startsWith(a + ' ') || h.endsWith(' ' + a) || h.includes(' ' + a + ' '));
}

function detectColumnMap(headerCols) {
  const lower = headerCols.map((c) => String(c || '').toLowerCase().trim());
  const find = (...aliases) => {
    const idx = lower.findIndex((h) => headerMatches(h, aliases));
    return idx >= 0 ? idx : -1;
  };
  const dateIdx = find('date', 'txn date', 'transaction date', 'value date', 'tran date', 'posting date');
  const descIdx = find('description', 'desc', 'narration', 'particular', 'particulars', 'details', 'remark', 'narrative', 'remarks');
  const debitIdx = find('debit', 'withdrawal', 'withdraw', 'withdrawal amt', 'dr', 'dr amount', 'paid out', 'debit amount');
  const creditIdx = find('credit', 'deposit', 'deposits', 'cr', 'cr amount', 'paid in', 'credit amount');
  const balanceIdx = find('balance', 'closing balance', 'running balance');

  if (dateIdx >= 0 || descIdx >= 0 || debitIdx >= 0 || creditIdx >= 0) {
    return {
      dateIdx: dateIdx >= 0 ? dateIdx : 0,
      descIdx: descIdx >= 0 ? descIdx : 1,
      debitIdx: debitIdx >= 0 ? debitIdx : 2,
      creditIdx: creditIdx >= 0 ? creditIdx : 3,
      balanceIdx: balanceIdx >= 0 ? balanceIdx : -1
    };
  }
  return { dateIdx: 0, descIdx: 1, debitIdx: 2, creditIdx: 3, balanceIdx: -1 };
}

function findTransactionHeaderLine(lines) {
  let best = -1;
  let bestScore = 0;
  for (let i = 0; i < Math.min(lines.length, 100); i++) {
    const cols = parseCsvLine(lines[i]);
    const lower = cols.map((c) => String(c || '').toLowerCase());
    let score = 0;
    if (lower.some((h) => /\bdate\b|txn date|value date|transaction date/.test(h))) score += 3;
    if (lower.some((h) => /narration|particular|description|remark/.test(h))) score += 2;
    if (lower.some((h) => /withdraw|debit\b|\bdr\b/.test(h) && !/address/.test(h))) score += 2;
    if (lower.some((h) => /deposit|credit\b|\bcr\b/.test(h))) score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return bestScore >= 4 ? best : -1;
}

function isMetadataRow(cols) {
  const joined = cols.join(' ').toLowerCase();
  if (/ifsc|account no|account number|customer id|account statement|branch name|micr|cod account|opening balance|closing balance|statement period|registered office/.test(joined)) {
    return true;
  }
  if (cols.some((c) => /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(String(c || '').trim()))) return true;
  if (cols.length >= 3 && !cols.some((c) => parseAmount(c) > 0) && !cols.some((c) => parseBankStatementDate(c))) {
    if (/haryana|india|private limited|ltd\.|bank ltd/.test(joined)) return true;
  }
  return false;
}

function pickDescription(cols, map, dateIdxUsed, amountIdxs) {
  const skip = new Set([map.dateIdx, map.debitIdx, map.creditIdx, map.balanceIdx, dateIdxUsed, ...amountIdxs].filter((x) => x >= 0));
  const parts = [];
  for (let j = 0; j < cols.length; j++) {
    if (skip.has(j)) continue;
    const cell = String(cols[j] || '').trim();
    if (!cell || cell.length < 2) continue;
    if (parseBankStatementDate(cell)) continue;
    if (parseAmount(cell) > 0) continue;
    if (/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(cell)) continue;
    if (/^\d{10,}$/.test(cell.replace(/\s/g, ''))) continue;
    parts.push(cell);
  }
  const description = parts.join(' — ').trim();
  if (description.length > 240) return description.slice(0, 237) + '…';
  return description || 'Bank entry';
}

function parseTransactionRow(cols, map) {
  if (isMetadataRow(cols)) return null;

  let dateIdx = map.dateIdx;
  let statementDate = parseBankStatementDate(cols[dateIdx]);
  if (!statementDate) {
    for (let j = 0; j < cols.length; j++) {
      const d = parseBankStatementDate(cols[j]);
      if (d) {
        statementDate = d;
        dateIdx = j;
        break;
      }
    }
  }
  if (!statementDate) return null;

  let debit = parseAmount(cols[map.debitIdx]);
  let credit = parseAmount(cols[map.creditIdx]);
  const amountHits = [];
  for (let j = 0; j < cols.length; j++) {
    const a = parseAmount(cols[j]);
    if (a > 0) amountHits.push({ j, a });
  }

  if (!debit && !credit && amountHits.length) {
    const nonBalance = amountHits.filter((h) => h.j !== map.balanceIdx);
    const pool = nonBalance.length ? nonBalance : amountHits;
    if (pool.length === 1) {
      if (map.debitIdx >= 0 && map.creditIdx >= 0 && map.debitIdx < map.creditIdx) {
        if (pool[0].j <= map.debitIdx + 1) debit = pool[0].a;
        else credit = pool[0].a;
      } else {
        credit = pool[0].a;
      }
    } else if (pool.length >= 2) {
      const ordered = pool.sort((a, b) => a.j - b.j);
      const a1 = ordered[ordered.length - 2].a;
      const a2 = ordered[ordered.length - 1].a;
      if (map.balanceIdx === ordered[ordered.length - 1].j) {
        debit = ordered.length >= 2 ? ordered[ordered.length - 3]?.a || ordered[0].a : 0;
        credit = ordered.length >= 3 ? ordered[ordered.length - 2].a : ordered[0].a;
      } else {
        debit = a1;
        credit = a2;
        if (debit === credit) credit = 0;
      }
    }
  }

  if (debit && credit && debit === credit) credit = 0;
  if (!debit && !credit) return null;

  const description = pickDescription(cols, map, dateIdx, amountHits.map((h) => h.j));
  if (/^(\d{1,2}[\s\/\-][A-Za-z]{3,9}[\s\/\-]\d{2,4}|\d{1,2}\/\d{1,2}\/\d{2,4})$/.test(description.trim())) {
    return null;
  }

  return { statementDate, description, debit, credit, date: statementDate };
}

function parseBankCsvRows(csvText) {
  const text = stripBom(csvText).trim();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 1) {
    return { rows: [], skipped: 0, errors: ['CSV khali hai.'] };
  }

  const headerLineIdx = findTransactionHeaderLine(lines);
  const headerCols = headerLineIdx >= 0 ? parseCsvLine(lines[headerLineIdx]) : parseCsvLine(lines[0]);
  const startIdx = headerLineIdx >= 0 ? headerLineIdx + 1 : 0;
  const map = detectColumnMap(headerCols);

  const rows = [];
  let skipped = 0;
  const errors = [];

  for (let i = startIdx; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (!cols.length || cols.every((c) => !c)) continue;

    const row = parseTransactionRow(cols, map);
    if (!row) {
      skipped++;
      continue;
    }
    rows.push(row);
  }

  if (!rows.length && skipped > 0) {
    errors.push('Koi sahi transaction row nahi mili. Bank CSV me "Date, Narration, Withdrawal/Debit, Deposit/Credit" wala section hona chahiye.');
  }

  return { rows, skipped, errors };
}

module.exports = {
  parseBankCsvRows,
  parseBankStatementDate,
  parseCsvLine,
  parseAmount,
  MAX_BANK_AMOUNT
};
