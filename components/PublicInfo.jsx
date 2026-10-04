import { publicInfo } from "../lib/public-info.mjs";
import { localeNames, LOCALES } from "../lib/i18n.mjs";

export default function PublicInfo({ kind, locale = "en" }) {
  const copy = publicInfo[locale] || publicInfo.en;
  return (
    <main className="public-info" lang={locale}>
      <header>
        <a href="/">{copy.back}</a>
        <nav aria-label="Language">
          {LOCALES.map((lang) => (
            <a
              key={lang}
              href={`/${kind}?lang=${lang}`}
              hrefLang={lang}
              aria-current={locale === lang ? "page" : undefined}
            >
              {localeNames[lang]}
            </a>
          ))}
        </nav>
      </header>
      <h1>{copy[kind]}</h1>
      <p className="muted">{copy.updated}</p>
      {copy[`${kind}Sections`].map(([heading, content]) => (
        <section key={heading}>
          <h2>{heading}</h2>
          <p>{content}</p>
        </section>
      ))}
      {kind === "privacy" && (
        <p>
          <a href="https://developers.google.com/terms/api-services-user-data-policy">
            Google API Services User Data Policy
          </a>
        </p>
      )}
      <footer>
        <a href="mailto:viethuy061002@gmail.com">{copy.contact}</a>
        <a href={`/${kind === "privacy" ? "terms" : "privacy"}?lang=${locale}`}>
          {copy[kind === "privacy" ? "terms" : "privacy"]}
        </a>
      </footer>
    </main>
  );
}
