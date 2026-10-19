/**
 * Seed script — run with: npm run seed
 * Populates categories + sample products and creates the default admin
 * account defined in .env (ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME).
 * Safe to re-run: uses INSERT IGNORE / ON DUPLICATE KEY UPDATE.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../server/config/db');

const categories = [
  { name: 'Coffee Beans', slug: 'coffee-beans', description: 'Whole and ground beans roasted in-house.' },
  { name: 'Brewed Coffee', slug: 'brewed-coffee', description: 'Ready-to-drink espresso based and filter coffee.' },
  { name: 'Pastries', slug: 'pastries', description: 'Fresh-baked pairings for your cup.' },
  { name: 'Merch', slug: 'merch', description: 'Cups, grinders and Noir Cafe gear.' },
];

// Prices are in pesewas (GHS minor unit). 100 pesewas = GHS 1.00
const products = [
  {
    name: ' Dark Roast', slug: 'dark-roast', category: 'coffee-beans',
    description: 'A bold, smoky dark roast with notes of dark chocolate and toasted hazelnut. 250g bag.',
    price_pesewas: 8500, stock: 40, is_featured: 1,
    image_url: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Volta Sunrise Light Roast', slug: 'volta-sunrise-light-roast', category: 'coffee-beans',
    description: 'Bright and fruity with citrus and honey notes. Ethically sourced Ghanaian-blend, 250g bag.',
    price_pesewas: 9200, stock: 35, is_featured: 1,
    image_url: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Midnight Espresso Blend', slug: 'midnight-espresso-blend', category: 'coffee-beans',
    description: 'A rich, syrupy espresso blend built for crema. 250g bag.',
    price_pesewas: 9800, stock: 30, is_featured: 0,
    image_url: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Noir Signature Espresso', slug: 'noir-signature-espresso', category: 'brewed-coffee',
    description: 'A double shot, pulled slow. Our house signature.',
    price_pesewas: 1800, stock: 999, is_featured: 1,
    image_url: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Cold Brew, 500ml', slug: 'cold-brew-500ml', category: 'brewed-coffee',
    description: 'Steeped for 18 hours. Smooth, low-acid, naturally sweet.',
    price_pesewas: 2500, stock: 60, is_featured: 1,
    image_url: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Flat White', slug: 'flat-white', category: 'brewed-coffee',
    description: 'Velvety microfoam over a double ristretto shot.',
    price_pesewas: 2100, stock: 999, is_featured: 0,
    image_url: 'https://images.unsplash.com/photo-1561882468-9110e03e0f78?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Spiced Hibiscus Latte', slug: 'spiced-hibiscus-latte', category: 'brewed-coffee',
    description: 'Espresso, steamed milk, and a house-made hibiscus-ginger syrup.',
    price_pesewas: 2400, stock: 999, is_featured: 1,
    image_url: 'https://images.unsplash.com/photo-1561047029-3000c68339ca?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Butter Croissant', slug: 'butter-croissant', category: 'pastries',
    description: 'Laminated 36 hours, baked fresh each morning.',
    price_pesewas: 1500, stock: 50, is_featured: 0,
    image_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Banana Walnut Loaf', slug: 'banana-walnut-loaf', category: 'pastries',
    description: 'A dense, moist slice with roasted walnuts.',
    price_pesewas: 1200, stock: 45, is_featured: 0,
    image_url: 'https://images.unsplash.com/photo-1605286658107-cb37f6e8b4f6?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Cinnamon Roll', slug: 'cinnamon-roll', category: 'pastries',
    description: 'Soft brioche swirl glazed with brown-butter icing.',
    price_pesewas: 1400, stock: 45, is_featured: 1,
    image_url: 'https://images.unsplash.com/photo-1509365465985-25d11c17e812?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Noir Ceramic Cup, 350ml', slug: 'noir-ceramic-cup', category: 'merch',
    description: 'Matte-black stoneware cup with the Noir Cafe crest.',
    price_pesewas: 6500, stock: 25, is_featured: 0,
    image_url: 'https://images.unsplash.com/photo-1572119865084-43c285814d63?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Hand Grinder, Steel Burr', slug: 'hand-grinder-steel-burr', category: 'merch',
    description: 'Adjustable conical burr grinder for filter and espresso.',
    price_pesewas: 24000, stock: 15, is_featured: 1,
    image_url: 'https://images.unsplash.com/photo-1516224498413-84ecf3a1e7fe?auto=format&fit=crop&w=800&q=80',
  },
];

async function seed() {
  const conn = await pool.getConnection();
  try {
    console.log('Seeding categories...');
    for (const c of categories) {
      await conn.query(
        `INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)`,
        [c.name, c.slug, c.description]
      );
    }

    const [catRows] = await conn.query('SELECT id, slug FROM categories');
    const catIdBySlug = Object.fromEntries(catRows.map((r) => [r.slug, r.id]));

    console.log('Seeding products...');
    for (const p of products) {
      await conn.query(
        `INSERT INTO products (category_id, name, slug, description, price_pesewas, image_url, stock, is_featured, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name), description = VALUES(description), price_pesewas = VALUES(price_pesewas),
           image_url = VALUES(image_url), stock = VALUES(stock), is_featured = VALUES(is_featured)`,
        [catIdBySlug[p.category], p.name, p.slug, p.description, p.price_pesewas, p.image_url, p.stock, p.is_featured]
      );
    }

    const adminEmail = process.env.ADMIN_EMAIL || '[email protected]';
    const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
    const adminName = process.env.ADMIN_NAME || 'Noir Cafe Admin';
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    console.log(`Seeding admin account (${adminEmail})...`);
    await conn.query(
      `INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, 'admin')
       ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)`,
      [adminName, adminEmail, passwordHash]
    );

    console.log('\nSeed complete.');
    console.log(`Admin login -> email: ${adminEmail}  password: ${adminPassword}`);
    console.log('(Change this password after first login.)');
  } finally {
    conn.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
