/**
 * 排班系統 - Google Apps Script 後端
 *
 * 使用方式：
 * 1. 在 Google Sheet 中開啟「擴充功能 → Apps Script」
 * 2. 將此檔案內容貼入編輯器（取代原本的 Code.gs）
 * 3. 部署為 Web App：部署 → 新增部署 → 網頁應用程式
 *    - 執行身分：我自己
 *    - 存取權限：所有人
 * 4. 複製部署後的 URL，貼到 index.html 的設定頁籤中
 *
 * 注意：所有操作（讀取與寫入）皆透過 doGet + JSONP 處理，
 * 以支援 file:// 協定下的跨域存取。
 */

// ========== 設定 ==========
var SHEET_SCHEDULE = '排班表';
var SHEET_STAFF = '人員名單';

// ========== 統一入口：doGet 處理所有操作（JSONP） ==========
function doGet(e) {
  var params = e.parameter;
  var callback = params.callback || 'callback';

  try {
    var action = params.action;
    var result;

    switch (action) {
      // 讀取
      case 'getSchedules': result = getSchedules(params); break;
      case 'getStaff':     result = getStaff(); break;
      // 寫入
      case 'addSchedule':    result = addSchedule(params); break;
      case 'deleteSchedule': result = deleteSchedule(params); break;
      case 'addStaff':       result = addStaff(params); break;
      case 'deleteStaff':    result = deleteStaff(params); break;
      default:
        result = { success: false, message: '未知的 action: ' + action };
    }

    return jsonpResponse(callback, result);
  } catch (err) {
    return jsonpResponse(callback, { success: false, message: '伺服器錯誤：' + err.message });
  }
}

// ========== 排班操作 ==========

function addSchedule(params) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SCHEDULE);
  if (!sheet) return { success: false, message: '找不到工作表：' + SHEET_SCHEDULE };

  var date = params.date;
  var name = params.name;
  var shift = params.shift;
  var startTime = params.startTime;
  var endTime = params.endTime;
  var note = params.note || '';

  if (!date || !name || !shift || !startTime || !endTime) {
    return { success: false, message: '必填欄位不完整' };
  }

  var weekday = getWeekday(date);
  var timestamp = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');

  sheet.appendRow([date, weekday, name, shift, startTime, endTime, note, timestamp]);

  return { success: true, message: '排班新增成功' };
}

function deleteSchedule(params) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SCHEDULE);
  if (!sheet) return { success: false, message: '找不到工作表：' + SHEET_SCHEDULE };

  var row = parseInt(params.row, 10);
  if (!row || row < 2) return { success: false, message: '無效的列號' };

  var lastRow = sheet.getLastRow();
  if (row > lastRow) return { success: false, message: '該列不存在' };

  sheet.deleteRow(row);
  return { success: true, message: '排班已刪除' };
}

function getSchedules(params) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SCHEDULE);
  if (!sheet) return { success: false, message: '找不到工作表：' + SHEET_SCHEDULE };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: true, data: [] };

  var data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  var results = data.map(function(row, index) {
    return {
      row: index + 2,
      date: formatDateValue(row[0]),
      weekday: row[1],
      name: row[2],
      shift: row[3],
      startTime: row[4],
      endTime: row[5],
      note: row[6],
      timestamp: row[7]
    };
  });

  if (params.filterDate) {
    results = results.filter(function(item) {
      return item.date === params.filterDate;
    });
  }

  if (params.filterName) {
    results = results.filter(function(item) {
      return item.name === params.filterName;
    });
  }

  return { success: true, data: results };
}

// ========== 人員操作 ==========

function addStaff(params) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_STAFF);
  if (!sheet) return { success: false, message: '找不到工作表：' + SHEET_STAFF };

  var name = params.name;
  var position = params.position || '';
  var contact = params.contact || '';

  if (!name) return { success: false, message: '姓名為必填' };

  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var names = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < names.length; i++) {
      if (names[i][0] === name) {
        return { success: false, message: '人員「' + name + '」已存在' };
      }
    }
  }

  sheet.appendRow([name, position, contact]);
  return { success: true, message: '人員新增成功' };
}

function deleteStaff(params) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_STAFF);
  if (!sheet) return { success: false, message: '找不到工作表：' + SHEET_STAFF };

  var row = parseInt(params.row, 10);
  if (!row || row < 2) return { success: false, message: '無效的列號' };

  var lastRow = sheet.getLastRow();
  if (row > lastRow) return { success: false, message: '該列不存在' };

  sheet.deleteRow(row);
  return { success: true, message: '人員已刪除' };
}

function getStaff() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_STAFF);
  if (!sheet) return { success: false, message: '找不到工作表：' + SHEET_STAFF };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: true, data: [] };

  var data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  var results = data.map(function(row, index) {
    return {
      row: index + 2,
      name: row[0],
      position: row[1],
      contact: row[2]
    };
  });

  return { success: true, data: results };
}

// ========== 工具函式 ==========

function getWeekday(dateStr) {
  var days = ['日', '一', '二', '三', '四', '五', '六'];
  var d = new Date(dateStr);
  return '星期' + days[d.getDay()];
}

function formatDateValue(val) {
  if (val instanceof Date) {
    var y = val.getFullYear();
    var m = ('0' + (val.getMonth() + 1)).slice(-2);
    var d = ('0' + val.getDate()).slice(-2);
    return y + '-' + m + '-' + d;
  }
  return String(val);
}

function jsonpResponse(callback, result) {
  var jsonStr = JSON.stringify(result);
  return ContentService
    .createTextOutput(callback + '(' + jsonStr + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
