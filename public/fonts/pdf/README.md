# PDF fonts

Noto Sans JP from Google Fonts, downloaded 2026-10-02:
https://github.com/google/fonts/tree/main/ofl/notosansjp
Source: `NotoSansJP[wght].ttf`, licensed under the included SIL Open Font License.

These static TrueType instances were produced with FontTools 4.66.1:
- `NotoSansJP-Regular.ttf`: weight 400
- `NotoSansJP-Semibold.ttf`: weight 600

The original character map is retained, including Japanese, Latin, and Vietnamese.
The application serves these locally and precaches them for offline PDF exports.
PDF generation embeds only the used glyphs.

To regenerate, use `fontTools.varLib.instancer.instantiateVariableFont` on the
source font with `{'wght': 400}` or `{'wght': 600}`, then save as the filename above.
