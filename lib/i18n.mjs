import messages from "../data/messages.json" with { type: "json" };
export const LOCALES = ["en", "ja", "vi"];
export const localeNames = { en: "English", ja: "日本語", vi: "Tiếng Việt" };
export function t(locale, key) {
  return messages[key]?.[locale] || messages[key]?.en || key;
}
export function money(value, locale = "en") {
  return value == null
    ? t(locale, "unknown")
    : new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "JPY",
        maximumFractionDigits: 0,
      }).format(value);
}
export function dateLabel(value, locale = "en", time = false) {
  if (!value) return t(locale, "unknown");
  const date = new Date(value);
  if (Number.isNaN(+date)) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    ...(time ? { timeStyle: "short" } : {}),
    timeZone: "Asia/Tokyo",
  }).format(date);
}
export function exportTimestamp(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const fields = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  return `${fields.year}-${fields.month}-${fields.day}_${fields.hour}-${fields.minute}-${fields.second}-${fields.fractionalSecond}`;
}
const errors = {
  INVALID_DATE: [
    "Enter a valid date or month and year.",
    "有効な日付または年月を入力してください。",
    "Nhập ngày hợp lệ hoặc tháng và năm.",
  ],
  INVALID_YEAR: [
    "Enter a four-digit year.",
    "西暦を4桁で入力してください。",
    "Nhập năm gồm bốn chữ số.",
  ],
  INVALID_ORDER: [
    "The property order is invalid. Refresh and try again.",
    "物件の順序が無効です。更新して再試行してください。",
    "Thứ tự căn hộ không hợp lệ. Tải lại và thử lại.",
  ],
  NETWORK_TIMEOUT: [
    "The server is taking too long. Your local drafts are kept. Please retry.",
    "サーバーの応答に時間がかかっています。端末の下書きは保持されています。再試行してください。",
    "Máy chủ phản hồi quá lâu. Bản nháp trên thiết bị vẫn được giữ. Hãy thử lại.",
  ],
  NETWORK_ERROR: [
    "Could not connect. Check your connection and retry. Your local drafts are kept.",
    "接続できません。通信状態を確認して再試行してください。端末の下書きは保持されています。",
    "Không thể kết nối. Kiểm tra kết nối và thử lại. Bản nháp trên thiết bị vẫn được giữ.",
  ],
  UNAUTHENTICATED: [
    "Please sign in again. Your drafts are kept.",
    "再ログインしてください。下書きは保持されています。",
    "Đăng nhập lại. Bản nháp vẫn được giữ.",
  ],
  FORBIDDEN: [
    "Your current role cannot make this change.",
    "現在の権限では変更できません。",
    "Quyền hiện tại không cho phép thay đổi này.",
  ],
  NOT_FOUND: [
    "This item is unavailable or you no longer have access.",
    "利用できない項目、またはアクセス権がありません。",
    "Mục không còn hoặc bạn đã mất quyền truy cập.",
  ],
  CONFLICT: [
    "A newer version has been saved. Compare it with your draft.",
    "新しい内容が保存されました。下書きと比較してください。",
    "Có phiên bản mới hơn. So sánh với bản nháp của bạn.",
  ],
  CHECKLIST_CHANGED: [
    "The shared checklist changed. Refresh it before retrying.",
    "共有リストが変更されました。更新後に再試行してください。",
    "Danh sách chung đã thay đổi. Làm mới rồi thử lại.",
  ],
  TYPE_CHANGE_BLOCKED: [
    "Existing answers prevent changing the type or unit. Add a new check instead.",
    "回答があるため形式・単位は変更できません。新しい項目を追加してください。",
    "Đã có câu trả lời nên không thể đổi loại hoặc đơn vị. Hãy thêm mục mới.",
  ],
  CONTRACT_REFERENCE_REQUIRED: [
    "Name or link the contract before marking it contract-confirmed.",
    "契約確認済みにするには契約書名かリンクが必要です。",
    "Nhập tên hoặc liên kết hợp đồng trước khi xác nhận theo hợp đồng.",
  ],
  GMAIL_CONNECT_REQUIRED: [
    "Connect your Gmail account, then resend this invitation.",
    "Gmailを接続し、招待を再送してください。",
    "Kết nối Gmail rồi gửi lại lời mời.",
  ],
  EMAIL_FAILED: [
    "The invitation could not be emailed. You can retry or copy its link.",
    "招待を送信できませんでした。再送かリンクのコピーができます。",
    "Chưa gửi được email. Thử lại hoặc sao chép liên kết.",
  ],
  INVITATION_EMAIL_MISMATCH: [
    "Sign in with the email address that received this invitation.",
    "招待されたメールアドレスでログインしてください。",
    "Đăng nhập bằng địa chỉ email được mời.",
  ],
  INVITATION_EXPIRED: [
    "This invitation expired. Ask the owner for a new one.",
    "招待の期限が切れました。新しい招待を依頼してください。",
    "Lời mời đã hết hạn. Nhờ chủ sở hữu gửi lại.",
  ],
  INVITATION_INVALID: [
    "This invitation is invalid or has been revoked.",
    "招待が無効、または取り消されました。",
    "Lời mời không hợp lệ hoặc đã thu hồi.",
  ],
  NAME_REQUIRED: ["Enter a name.", "名前を入力してください。", "Nhập tên."],
  INVALID_URL: [
    "Use a complete http or https link.",
    "httpまたはhttpsの完全なリンクを入力してください。",
    "Dùng liên kết http hoặc https đầy đủ.",
  ],
  INVALID_AMOUNT: [
    "Enter a non-negative number.",
    "0以上の数値を入力してください。",
    "Nhập số không âm.",
  ],
  FILE_INVALID: [
    "Choose JPEG, PNG, WebP or PDF, up to 20 MB.",
    "20 MB以内のJPEG・PNG・WebP・PDFを選択してください。",
    "Chọn JPEG, PNG, WebP hoặc PDF, tối đa 20 MB.",
  ],
  STORAGE_FULL: [
    "Device storage is full. Your current input remains visible. Export drafts or free space.",
    "端末の容量が不足しています。入力は保持されています。下書きを書き出すか容量を空けてください。",
    "Bộ nhớ thiết bị đầy. Nội dung vẫn hiển thị. Xuất bản nháp hoặc giải phóng bộ nhớ.",
  ],
  DATABASE_NOT_CONFIGURED: [
    "Configure the database using the setup guide.",
    "ガイドに従ってDBを設定してください。",
    "Cấu hình cơ sở dữ liệu theo hướng dẫn.",
  ],
  CRITERION_UNAVAILABLE: [
    "This check was archived or disabled. Export the draft if you need to keep it.",
    "項目が非表示または無効です。必要なら下書きを書き出してください。",
    "Mục đã lưu trữ hoặc tắt. Xuất bản nháp nếu cần giữ.",
  ],
  APARTMENT_UNAVAILABLE: [
    "This apartment was archived. Your draft has been kept.",
    "物件が非表示になりました。下書きは保持されています。",
    "Căn hộ đã lưu trữ. Bản nháp vẫn được giữ.",
  ],
};
export function errorText(locale, error) {
  const code = typeof error === "string" ? error : error?.error || error?.code;
  const values = errors[code];
  return values
    ? values[LOCALES.indexOf(locale)] || values[0]
    : t(locale, "error");
}

export function unitLabel(unit, locale) {
  if (unit === "year") return "";
  return ["minutes", "transfers", "burners"].includes(unit)
    ? t(locale, unit)
    : unit === "JPY/month"
      ? "¥"
      : unit || "";
}

export function checklistValueLabel(value, criterion, locale = "en") {
  if (criterion.type === "date") {
    const monthOnly = value.length === 7;
    if (monthOnly) {
      const [year, month] = value.split("-");
      return locale === "ja" ? `${year}/${month}` : `${month}/${year}`;
    }
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00Z`));
  }
  const formatted =
    criterion.type === "number"
      ? new Intl.NumberFormat(locale, {
          useGrouping: criterion.unit !== "year",
        }).format(value)
      : value;
  const unit = unitLabel(criterion.unit, locale);
  return `${formatted}${unit ? ` ${unit}` : ""}`;
}
