<div align="center">

<img src="./concierge-icon-square.svg" alt="Concierge logo" width="128">

# Concierge brand assets

Self-contained artwork for repository, package, product, and status surfaces.

</div>

## Asset catalog

Every named asset is available as an editable SVG and a rendered PNG.

| Base name | Intended use |
| --- | --- |
| `concierge-mark-light` | Standard mark on black or another dark surface |
| `concierge-mark-navy` | Standard mark on the light brand surface |
| `concierge-mark-black` | Standard mark on the orange brand surface |
| `concierge-mark-small-light` | Light mark displayed below 20px high |
| `concierge-mark-small-orange` | CLI or status mark displayed below 20px high |
| `concierge-wordmark-horizontal` | Compact black-backed header and package artwork |
| `concierge-wordmark-stacked` | Stacked black-backed product wordmark |
| `concierge-icon-square` | README badge and square app tile |
| `concierge-icon-rounded` | Rounded app tile |
| `concierge-favicon` | Mark-only black favicon source |

`concierge.ico` contains 16, 24, 32, 48, 64, 128, and 256px frames.

## Export sizes

- Marks and the stacked wordmark use a 1024px longest edge.
- App icons are 1024×1024px.
- The horizontal wordmark is 1600×414px.
- The favicon PNG is 512×512px.
- SVGs remain the source of truth and contain only paths and basic vector
  primitives. They do not load fonts, scripts, or external images.

## Palette

| Role | Value |
| --- | --- |
| Light mark | `#F1F5F9` |
| Navy mark | `#0F172A` |
| Black surface and mark | `#000000` |
| CLI/status orange | `#FF6B35` |
| Secondary wordmark | `#94A3B8` |

## Geometry and usage

The standard mark combines a Poppins Thin `C` with the constructed Concierge
`G`: a ring, 62° aperture, and mid-height spur. At sizes below 20px, use the
small asset, which steps the `C` up to Poppins 200 and increases the ring and
spur from 24 to 26 units.

Orange is reserved for CLI and status use. Concierge may sit beside the FSB
mark with a divider, but the two marks must not be fused into a replacement
lockup.

The outlined glyphs are derived from
[Poppins](https://github.com/google/fonts/blob/main/ofl/poppins/OFL.txt) and
[Space Mono](https://github.com/google/fonts/blob/main/ofl/spacemono/OFL.txt),
both distributed under the SIL Open Font License 1.1. No font binaries are
included in this directory.
