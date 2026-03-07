-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    icon VARCHAR(20),
    color VARCHAR(7),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- New columns on tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Default categories
INSERT INTO categories (name, icon, color, sort_order) VALUES
    ('Work', 'briefcase', '#3B82F6', 1),
    ('Personal', 'heart', '#10B981', 2),
    ('Wishlist', 'flag', '#F59E0B', 3),
    ('Birthday', 'cake', '#EC4899', 4)
ON CONFLICT DO NOTHING;
