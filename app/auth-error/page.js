import { headers } from "next/headers";
import { LOCALES, localeNames } from "../../lib/i18n.mjs";

const messages = {
  en: {
    title: "Sign-in could not be completed.",
    explanation:
      "Start again from House Checklist in one tab. An older Google sign-in page may have expired or been replaced by another sign-in attempt.",
    gmail:
      "If you were connecting Gmail, return to Members and choose Connect Gmail again.",
    saved: "Your saved apartments and drafts have not been changed.",
    back: "Return to House Checklist",
    help: "If a fresh attempt also fails, contact support.",
    contact: "Contact support",
  },
  ja: {
    title: "ログインを完了できませんでした。",
    explanation:
      "House Checklistに戻り、1つのタブでやり直してください。以前のGoogleログイン画面は期限切れ、または別のログイン操作で置き換えられた可能性があります。",
    gmail:
      "Gmailを接続していた場合は、メンバー画面に戻り、もう一度「Gmailを接続」を選んでください。",
    saved: "保存済みの物件と下書きは変更されていません。",
    back: "House Checklistに戻る",
    help: "新しくやり直しても失敗する場合は、サポートに連絡してください。",
    contact: "サポートに連絡",
  },
  vi: {
    title: "Chưa thể hoàn tất đăng nhập.",
    explanation:
      "Quay lại House Checklist và thử lại trong một tab. Trang đăng nhập Google cũ có thể đã hết hạn hoặc bị thay thế bởi lần đăng nhập khác.",
    gmail:
      "Nếu đang kết nối Gmail, quay lại Thành viên và chọn Kết nối Gmail lần nữa.",
    saved: "Các căn hộ đã lưu và bản nháp của bạn không bị thay đổi.",
    back: "Quay lại House Checklist",
    help: "Nếu lần thử mới vẫn thất bại, hãy liên hệ hỗ trợ.",
    contact: "Liên hệ hỗ trợ",
  },
};

export const metadata = { title: "Sign-in recovery · House Checklist" };

export default async function AuthError({ searchParams }) {
  const { lang } = await searchParams;
  const preferred = (await headers()).get("accept-language") || "";
  const browserLocale = preferred
    .split(",")
    .map((value) => value.trim().split(/[-;]/)[0])
    .find((value) => LOCALES.includes(value));
  const locale = LOCALES.includes(lang) ? lang : browserLocale || "en";
  const copy = messages[locale];
  return (
    <main className="public-info" lang={locale}>
      <header>
        <a href="/">House Checklist</a>
        <nav aria-label="Language">
          {LOCALES.map((value) => (
            <a
              key={value}
              href={`/auth-error?lang=${value}`}
              hrefLang={value}
              aria-current={locale === value ? "page" : undefined}
            >
              {localeNames[value]}
            </a>
          ))}
        </nav>
      </header>
      <h1>{copy.title}</h1>
      <p>{copy.explanation}</p>
      <p>{copy.gmail}</p>
      <p className="muted">{copy.saved}</p>
      <p>
        <a className="button primary" href="/">
          {copy.back}
        </a>
      </p>
      <footer>
        <p>{copy.help}</p>
        <a href="mailto:viethuy061002@gmail.com">{copy.contact}</a>
      </footer>
    </main>
  );
}
