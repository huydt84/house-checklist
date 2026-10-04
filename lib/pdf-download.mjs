import { downloadBlob } from "./client-store.mjs";

let renderer;
async function loadRenderer() {
  if (!renderer) {
    renderer = import("pdfmake/build/pdfmake")
      .then((module) => {
        const pdf = module.default || module;
        pdf.addFonts({
          NotoSansJP: {
            normal: new URL(
              "/fonts/pdf/NotoSansJP-Regular.ttf",
              location.origin,
            ).href,
            bold: new URL("/fonts/pdf/NotoSansJP-Semibold.ttf", location.origin)
              .href,
            italics: new URL(
              "/fonts/pdf/NotoSansJP-Regular.ttf",
              location.origin,
            ).href,
            bolditalics: new URL(
              "/fonts/pdf/NotoSansJP-Semibold.ttf",
              location.origin,
            ).href,
          },
        });
        return pdf;
      })
      .catch((error) => {
        renderer = undefined;
        throw error;
      });
  }
  return renderer;
}
export async function downloadPdf(report) {
  const pdf = await loadRenderer();
  const blob = await pdf.createPdf(report.document).getBlob();
  downloadBlob(blob, report.filename);
}
