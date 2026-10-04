import PublicInfo from "../../components/PublicInfo.jsx";
export const metadata = { title: "Privacy policy · House Checklist" };
export default async function PrivacyPage({ searchParams }) {
  const { lang } = await searchParams;
  return (
    <PublicInfo
      kind="privacy"
      locale={["en", "ja", "vi"].includes(lang) ? lang : "en"}
    />
  );
}
