import PublicInfo from "../../components/PublicInfo.jsx";
export const metadata = { title: "Terms of use · House Checklist" };
export default async function TermsPage({ searchParams }) {
  const { lang } = await searchParams;
  return (
    <PublicInfo
      kind="terms"
      locale={["en", "ja", "vi"].includes(lang) ? lang : "en"}
    />
  );
}
