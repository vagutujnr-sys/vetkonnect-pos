CREATE TABLE inventory_categories (
    id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT inventory_category_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX inventory_category_organization_name_key
    ON inventory_categories(organization_id, lower(name));

CREATE INDEX inventory_category_organization_id_idx
    ON inventory_categories(organization_id);

CREATE FUNCTION seed_default_inventory_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO inventory_categories (id, organization_id, name)
    VALUES
        (NEW.id || ':category:' || md5('dog_food'), NEW.id, 'DOG_FOOD'),
        (NEW.id || ':category:' || md5('cat_food'), NEW.id, 'CAT_FOOD'),
        (NEW.id || ':category:' || md5('supplements'), NEW.id, 'SUPPLEMENTS'),
        (NEW.id || ':category:' || md5('leads'), NEW.id, 'LEADS'),
        (NEW.id || ':category:' || md5('collars'), NEW.id, 'COLLARS'),
        (NEW.id || ':category:' || md5('bowls'), NEW.id, 'BOWLS'),
        (NEW.id || ':category:' || md5('toys'), NEW.id, 'TOYS'),
        (NEW.id || ':category:' || md5('grooming'), NEW.id, 'GROOMING'),
        (NEW.id || ':category:' || md5('other'), NEW.id, 'OTHER'),
        (NEW.id || ':category:' || md5('medicine'), NEW.id, 'Medicine')
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER organization_seed_inventory_categories
AFTER INSERT ON organizations
FOR EACH ROW
EXECUTE FUNCTION seed_default_inventory_categories();

INSERT INTO inventory_categories (id, organization_id, name)
SELECT DISTINCT
    organizations.id || ':category:' || md5(lower(category_names.name)),
    organizations.id,
    category_names.name
FROM organizations
CROSS JOIN (
    VALUES
        ('DOG_FOOD'),
        ('CAT_FOOD'),
        ('SUPPLEMENTS'),
        ('LEADS'),
        ('COLLARS'),
        ('BOWLS'),
        ('TOYS'),
        ('GROOMING'),
        ('OTHER'),
        ('Medicine')
) AS category_names(name)
ON CONFLICT DO NOTHING;

INSERT INTO inventory_categories (id, organization_id, name)
SELECT DISTINCT
    products.organization_id || ':category:' || md5(lower(products.category)),
    products.organization_id,
    products.category
FROM products
WHERE products.category <> ''
ON CONFLICT DO NOTHING;

INSERT INTO inventory_categories (id, organization_id, name)
SELECT DISTINCT
    medications.organization_id || ':category:' || md5(lower(medications.category)),
    medications.organization_id,
    medications.category
FROM medications
WHERE medications.category <> ''
ON CONFLICT DO NOTHING;
