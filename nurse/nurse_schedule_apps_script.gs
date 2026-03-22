// ══════════════════════════════════════════════════════════════
//  護理排班管理系統 — Google Apps Script 後端 v2
//  貼到：試算表(nurse) → 擴充功能 → Apps Script(nurse.gs)
//  部署為「網頁應用程式」，執行身分=我，存取權=所有人
//  ⚠️ 每次修改後請「管理部署作業 → 編輯 → 新增版本」重新部署
// ══════════════════════════════════════════════════════════════

const SPREADSHEET_ID = '1IowfeRXUCN-Y4Uvs0bFN0_lgQfjeBURPNgwcaXiyTT8';
const SHEET_NAME     = 'nurse';   // ← 已更正為你的工作表名稱

// ══════════════════════════════════════════════════════════════
//  所有請求統一走 doGet(e)
//  action=read  → 讀取試算表，回傳 JSON
//  action=write → 接收 data 參數（JSON字串），寫入試算表
// ══════════════════════════════════════════════════════════════
function doGet(e) {
  const params   = e.parameter || {};
  const callback = params.callback || 'callback';
  const action   = params.action || 'read';
  try {
    let result;
    if (action === 'write') {
      result = handleWriteData(e);
    } else {
      result = handleReadData();
    }
    return jsonpResponse(callback, result);
  } catch (err) {
    return jsonpResponse(callback, { ok: false, error: err.message });
  }
}

// ── 讀取 ──────────────────────────────────────────────────────
function handleReadData() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss);
  const data  = sheet.getDataRange().getValues();

  const result = [];
  let curBlock = null;

  data.forEach(row => {
    const cell = String(row[0] || '').trim();
    if (!cell) return;

    const secMatch = cell.match(/^(\d+)年(\d+)月$/);
    if (secMatch) {
      curBlock = {
        year:  parseInt(secMatch[1]),
        month: parseInt(secMatch[2]) - 1,
        rows:  []
      };
      result.push(curBlock);
      return;
    }
    if (cell === '護理師') return;
    if (curBlock) {
      curBlock.rows.push(row.map(c => String(c).trim()));
    }
  });

  return { ok: true, data: result };
}

// ── 寫入 ──────────────────────────────────────────────────────
function handleWriteData(e) {
  const raw = e.parameter && e.parameter.data;
  if (!raw) return { ok: false, error: 'no data parameter' };

  const payload = JSON.parse(raw);
  const ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet   = getOrCreateSheet(ss);

  sheet.clearContents();
  sheet.clearFormats();

  const output = [];

  payload.months.forEach((blk, bi) => {
    const { year, month, nurses } = blk;
    const days = new Date(year, month + 1, 0).getDate();

    if (bi > 0) output.push(Array(days + 1).fill(''));
    output.push([`${year}年${month + 1}月`, ...Array(days).fill('')]);
    output.push(['護理師', ...Array.from({ length: days }, (_, i) => i + 1)]);
    Object.entries(nurses).forEach(([name, shifts]) => {
      output.push([name, ...shifts]);
    });
  });

  if (output.length > 0) {
    const maxCols = Math.max(...output.map(r => r.length));
    const padded  = output.map(r => {
      const row = [...r];
      while (row.length < maxCols) row.push('');
      return row;
    });
    sheet.getRange(1, 1, padded.length, maxCols).setValues(padded);
    formatSheet(sheet, output);
  }

  return { ok: true, written: output.length };
}

// ── 工具：取得或建立工作表 ──────────────────────────────────────
function getOrCreateSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  return sheet;
}

// ── 工具：格式化 ────────────────────────────────────────────────
function formatSheet(sheet, output) {
  output.forEach((row, i) => {
    const rowNum = i + 1;
    const cell0  = String(row[0] || '');
    if (cell0.match(/^\d+年\d+月$/)) {
      sheet.getRange(rowNum, 1, 1, row.length)
        .setBackground('#C0392B').setFontColor('#FFFFFF').setFontWeight('bold');
    } else if (cell0 === '護理師') {
      sheet.getRange(rowNum, 1, 1, row.length)
        .setBackground('#FDECEA').setFontWeight('bold').setFontColor('#C0392B');
    } else if (cell0) {
      sheet.getRange(rowNum, 1).setFontWeight('bold');
    }
  });
}

// ── 工具：JSONP 回應（支援 file:// 跨域存取） ────────────────────
function jsonpResponse(callback, obj) {
  return ContentService
    .createTextOutput(callback + '(' + JSON.stringify(obj) + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
