/**
 * Bank statement CSV — parse dates (India DD/MM/YYYY) and quoted fields.
 */

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

function parseBankStatementDate(raw) {
  const s = String(raw || '').trim().replace(/^"|"$/g, '');
  if (!s || /^date$/i.test(s)) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  const dmY = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmY) {
    const day = parseInt(dmY[1], 10);
    const month = parseInt(dmY[2], 10) - 1;
    let year = parseInt(dmY[3], 10);
    if (year < 100) year += 2000;
    const dt = new Date(year, month, day);
    if (!Number.isNaN(dt.getTime()) && dt.getDate() === day) return dt;
  }

  const yMd = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (yMd) {
    const day = parseInt(yMd[2], 10);
    const month = parseInt(yMd[1], 10) - 1;
    const year = parseInt(yMd[3], 10);
    const dt = new Date(year, month, day);
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return null;
}

function parseAmount(raw) {
  if (raw === undefined || raw === null || raw === '') return 0;
  const cleaned = String(raw).replace(/[₹,\s]/g, '').replace(/[^\d.-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
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
  const dateIdx = find('date', 'txn date', 'transaction date', 'value date', 'tran date');
  const descIdx = find('description', 'desc', 'narration', 'particular', 'particulars', 'details', 'remark', 'narrative');
  let debitIdx = find('debit', 'withdrawal', 'withdraw', 'withdrawal amt', 'dr amount', 'paid out', 'payment amount');
  let creditIdx = find('credit', 'deposit', 'deposits', 'cr amount', 'paid in', 'receipt');
  if (dateIdx >= 0 || descIdx >= 0 || debitIdx >= 0 || creditIdx >= 0) {
    return {
      dateIdx: dateIdx >= 0 ? dateIdx : 0,
      descIdx: descIdx >= 0 ? descIdx : 1,
      debitIdx: debitIdx >= 0 ? debitIdx : 2,
      creditIdx: creditIdx >= 0 ? creditIdx : 3
    };
  }
  return { dateIdx: 0, descIdx: 1, debitIdx: 2, creditIdx: 3 };
}

function parseBankCsvRows(csvText) {
  const text = stripBom(csvText).trim();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 1) {
    return { rows: [], skipped: 0, errors: ['CSV khali hai.'] };
  }

  const headerCols = parseCsvLine(lines[0]);
  const looksLikeHeader = headerCols.some((c) => /date|desc|debit|credit|narration|withdraw|deposit/i.test(c));
  const startIdx = looksLikeHeader ? 1 : 0;
  const map = looksLikeHeader ? detectColumnMap(headerCols) : { dateIdx: 0, descIdx: 1, debitIdx: 2, creditIdx: 3 };

  const rows = [];
  let skipped = 0;
  const errors = [];

  for (let i = startIdx; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (!cols.length || cols.every((c) => !c)) continue;

    const dateRaw = cols[map.dateIdx] ?? cols[0];
    const statementDate = parseBankStatementDate(dateRaw);
    if (!statementDate) {
      skipped++;
      if (errors.length < 5) errors.push(`Row ${i + 1}: date samajh nahi aayi (“${dateRaw}”) — DD/MM/YYYY use karein.`);
      continue;
    }

    const description = (cols[map.descIdx] ?? cols[1] ?? 'Bank entry').trim() || 'Bank entry';
    const debit = parseAmount(cols[map.debitIdx] ?? cols[2]);
    const credit = parseAmount(cols[map.creditIdx] ?? cols[3]);

    if (!debit && !credit && !description) {
      skipped++;
      continue;
    }

    rows.push({ statementDate, description, debit, credit, date: statementDate });
  }

  return { rows, skipped, errors };
}

module.exports = {
  parseBankCsvRows,
  parseBankStatementDate,
  parseCsvLine
};
