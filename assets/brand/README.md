# House Checklist brand assets

The house-and-check mark is original, authored vector geometry. The sharing image is a deterministic composition of that mark, Geist typography, and the application's neutral and deep-teal palette. It contains no user or apartment data. No generated imagery or third-party property photos are used.

Run `pnpm assets:brand` to regenerate the SVG, 16/32/48 px ICO frames, 180 px Apple icon, 192/512 px installation icons, and 1200 × 630 px sharing preview from `scripts/brand-assets.mjs`. Generated files are committed with the app; production does not need to render them at runtime.

Geist is bundled here solely for reproducible asset rendering. The font comes from the [Google Fonts Geist repository](https://github.com/google/fonts/tree/main/ofl/geist) and is licensed under the SIL Open Font License included in `OFL.txt`. The application continues to use its existing Next.js font setup.

Next.js discovers the favicon, Apple icon, and Open Graph image in `app/`. The root metadata also declares the SVG favicon and a large Twitter card. The install manifest declares ordinary and maskable PNG icons.
