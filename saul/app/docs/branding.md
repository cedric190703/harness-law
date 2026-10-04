# Saul app branding

Scope: replace the generic layers brand icon with a custom Saul monogram and capitalize the visible product name in desktop and mobile UI. Reuse the mark in assistant avatars and the browser favicon.

Keep the existing Next.js stack, forest-green/ivory palette, serif wordmark, layout, and interactions. No data, API, security, dependency, or deployment changes.

Acceptance: the logo is legible at sidebar/avatar sizes, the brand reads “Saul” at all breakpoints, static assets live in this project, and lint/type checks pass. Verify desktop and mobile rendering locally. Revert the branding assets and component/style edits to roll back.

Generated with the built-in imagegen tool. Source: `public/brand/saul-mark-source.png`; UI asset: `public/brand/saul-mark.png` (256px); browser icon: `src/app/favicon.ico` (16/32/48px). Sharp resizes the source for delivery, preserving the generated artwork.

## Generation prompt

Use case: logo-brand. Asset type: production app icon for Saul, a refined legal research and evidence workspace. Create one distinctive, beautifully balanced capital S monogram, its two flowing folded-paper strokes subtly suggesting linked evidence/document ribbons. Bold simple silhouette, editorial sophistication, softly chamfered terminals, legible at 24px. Flat warm ivory (#edf4e7) symbol on a completely uniform solid deep forest green (#304b36) square background extending exactly to all four image edges. Centered mark occupies about 70% of the square. No border, no outer margins beyond the intentional green breathing room, no rounded container baked into image. Strictly flat vector-like graphic, no gradients, no texture, no lighting or 3D, no scales/gavel, no extra symbols, no text other than the single S monogram, no mockup. Square 1024x1024.
