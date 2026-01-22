-- +goose Up
-- Enum definition for course catalog status
CREATE TYPE course_catalog_status_enum AS ENUM (
    'active',           -- Aktif ders (öğrencilere açılabilir)
    'draft',            -- Taslak (henüz onaylanmamış)
    'pending_approval', -- Onay bekliyor
    'under_revision',   -- Revizyon aşamasında
    'archived',         -- Arşivlenmiş (artık açılmaz, eski kayıtlar için)
    'suspended'         -- Askıya alınmış (geçici olarak kapatılmış)
);

-- Enum definition for course type
CREATE TYPE course_type_enum AS ENUM (
    'mandatory',        -- Zorunlu ders
    'elective'          -- Seçmeli ders
);

CREATE TABLE IF NOT EXISTS course_catalog (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    course_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    faculty VARCHAR(100) NOT NULL,              -- Fakülte
    department VARCHAR(100) NOT NULL,           -- Bölüm
    class_level SMALLINT NOT NULL CHECK (class_level BETWEEN 1 AND 6),  -- Dersin ait olduğu sınıf seviyesi (1-6)
    credits SMALLINT NOT NULL CHECK (credits > 0 AND credits <= 30),  -- Toplam kredi (max 30)
    theoretical_hours SMALLINT NOT NULL DEFAULT 0 CHECK (theoretical_hours >= 0 AND theoretical_hours <= 20),
    practical_hours SMALLINT NOT NULL DEFAULT 0 CHECK (practical_hours >= 0 AND practical_hours <= 20),
    course_type course_type_enum NOT NULL DEFAULT 'mandatory',

    -- Denormalized structure for read performance
    -- [{id, course_code, course_name}, ...] (denormalized for read performance)
    prerequisites JSONB DEFAULT '[]',

    description TEXT,                           -- Ders tanımı
    learning_outcomes TEXT,                     -- Öğrenim çıktıları
    syllabus TEXT,                              -- Ders içeriği / müfredat
    status course_catalog_status_enum DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_catalog_code ON course_catalog(course_code);
CREATE INDEX idx_catalog_department ON course_catalog(department);
CREATE INDEX idx_catalog_prerequisites_gin ON course_catalog USING GIN(prerequisites);
CREATE INDEX idx_catalog_status ON course_catalog(status);
CREATE INDEX idx_catalog_course_type ON course_catalog(course_type);
CREATE INDEX idx_catalog_class_level ON course_catalog(class_level);

-- +goose Down
DROP TABLE IF EXISTS course_catalog;
DROP TYPE IF EXISTS course_type_enum;
DROP TYPE IF EXISTS course_catalog_status_enum;
