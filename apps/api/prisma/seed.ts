import 'dotenv/config';
import { createDatabase } from '../src/infrastructure/database.js';
import type { CatalogCategory } from '../src/application/catalog.js';

const catalog = [
  ['field-75', 'Field 75', 'keyboards', '75% wireless mechanical', 'An aluminum daily driver with a tactile volume dial and a compact 75% layout.', 'board-graphite', 14900],
  ['clay-keycaps', 'Clay Keycaps', 'keycaps', 'Cherry profile · 135 keys', 'A warm palette of kiln-fired tones in durable, textured PBT.', 'caps', 4900],
  ['surface-mat', 'Surface Mat', 'desk-gear', '900 × 400 mm · stitched edge', 'A tightly woven surface that keeps the rest of your setup steady.', 'mat', 3200],
  ['form-65', 'Form 65', 'keyboards', '65% low-profile wireless', 'A low-profile board with a small footprint and dedicated arrow keys.', 'board-bone', 11900],
  ['coil-01', 'Coil 01', 'desk-gear', 'Coiled USB-C · aviator connector', 'A braided, detachable cable with a brushed metal connector.', 'cable', 2900],
  ['amber-switches', 'Amber Switches', 'desk-gear', 'Tactile · 35-pack', 'A medium-weight tactile switch with a distinct bump and warm tone.', 'switches', 1800],
  ['frame-tkl', 'Frame TKL', 'keyboards', 'Tenkeyless · gasket mount', 'A gasket-mounted board for anyone who wants a full function row.', 'board-graphite', 16900],
  ['mono-60', 'Mono 60', 'keyboards', '60% compact · wired', 'A compact wired board made for travel and smaller desks.', 'board-bone', 9900],
  ['axis-75', 'Axis 75', 'keyboards', '75% layout · hot-swappable', 'A hot-swappable board with a forgiving typing angle.', 'board-graphite', 13900],
  ['relay-65', 'Relay 65', 'keyboards', '65% layout · dual mode', 'A dual-mode keyboard with quiet switches and a removable USB-C cable.', 'board-bone', 10900],
  ['block-96', 'Block 96', 'keyboards', '96% layout · numpad', 'A close-packed full-size layout with a dedicated number pad.', 'board-graphite', 17900],
  ['line-68', 'Line 68', 'keyboards', '68 keys · low profile', 'A shallow case and simple switch plate for long writing sessions.', 'board-bone', 11500],
  ['dune-keycaps', 'Dune Keycaps', 'keycaps', 'OEM profile · 110 keys', 'Soft desert tones on a slightly taller OEM profile.', 'caps', 3900],
  ['oxide-keycaps', 'Oxide Keycaps', 'keycaps', 'Cherry profile · 140 keys', 'A warm, dark set with accent keys for compact layouts.', 'caps', 5500],
  ['kiln-keycaps', 'Kiln Keycaps', 'keycaps', 'DSA profile · 125 keys', 'A uniform profile that works for flexible key layouts.', 'caps', 4500],
  ['archive-keycaps', 'Archive Keycaps', 'keycaps', 'Cherry profile · 150 keys', 'An extended kit with extras for split and full-size boards.', 'caps', 5900],
  ['loam-keycaps', 'Loam Keycaps', 'keycaps', 'XDA profile · 120 keys', 'Broad, flat keytops and warm neutrals for everyday typing.', 'caps', 4400],
  ['surface-mini', 'Surface Mini', 'desk-gear', '600 × 300 mm · stitched edge', 'A smaller edition of the Surface Mat for narrow desktops.', 'mat', 2400],
  ['surface-xl', 'Surface XL', 'desk-gear', '1000 × 450 mm · stitched edge', 'A broad woven mat that fits a full-size board and mouse.', 'mat', 3900],
  ['coil-02', 'Coil 02', 'desk-gear', 'Coiled USB-C · 1.8 m', 'A longer braided cable for standing desks and docking stations.', 'cable', 3500],
  ['link-usb', 'Link USB-C', 'desk-gear', 'Braided USB-C · 1.2 m', 'A short braided connection for compact desks and travel kits.', 'cable', 1900],
  ['honey-switches', 'Honey Switches', 'desk-gear', 'Linear · 35-pack', 'Light linear switches with a smooth travel and soft bottom-out.', 'switches', 1700],
  ['clear-switches', 'Clear Switches', 'desk-gear', 'Silent linear · 35-pack', 'A dampened linear switch suited to shared workspaces.', 'switches', 2100],
  ['amber-switches-xl', 'Amber Switches XL', 'desk-gear', 'Tactile · 90-pack', 'The Amber tactile switch in a pack sized for larger layouts.', 'switches', 4100],
] as const satisfies ReadonlyArray<readonly [string, string, CatalogCategory, string, string, string, number]>;

const db = createDatabase();
try {
  await db.$transaction(async (tx) => {
    for (const [featured, [slug, name, category, description, detail, image, priceCents]] of catalog.entries()) {
      const product = { name, category, description, detail, image: `/gear/${image}.webp`, priceCents, featured };
      await tx.product.upsert({ where: { slug }, create: { slug, ...product }, update: product });

      const colors: ReadonlyArray<readonly [label: string, swatch: string]> = category === 'keycaps'
        ? [['Clay', '#a85f46'], ['Sand', '#d7c5a9']]
        : image === 'board-bone' || image === 'cable'
          ? [['Bone', '#e9e2d2'], ['Graphite', '#33312f']]
          : [['Graphite', '#33312f'], ['Bone', '#e9e2d2']];

      for (const [position, [label, swatch]] of colors.entries()) {
        const id = `${slug}-${label.toLowerCase()}`;
        const stock = id === 'field-75-graphite' ? 1 : 6 + (featured + position) % 8;
        await tx.variant.upsert({
          where: { id },
          create: { id, productSlug: slug, label, swatch, stock, position },
          update: { label, swatch, position },
        });
      }
    }
  });
  console.log(`Seeded ${catalog.length} products.`);
} finally {
  await db.$disconnect();
}
