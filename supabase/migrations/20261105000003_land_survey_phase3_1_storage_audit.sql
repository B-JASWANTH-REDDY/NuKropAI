-- ============================================================================
-- NUKROPAI AGRARIAN OS — LAND SURVEY INTELLIGENCE PHASE 3.1
-- CRITICAL DOCUMENT PIPELINE AUDIT, PRIVATE STORAGE & SIGNATURE GOVERNANCE
-- ============================================================================
-- 1. Creates private 'farmer-land-documents' Supabase Storage bucket with strict RLS
-- 2. Adds storage_bucket, storage_path, file_format, retention_status to farmer_land_documents
-- 3. Adds distinct signature_status and farmer_confirmed tracking
-- 4. Cleanly separates source lifecycle (ACTIVE/SUPERSEDED) from authorization (APPROVED/PENDING)
-- ============================================================================

-- 1. STORAGE BUCKET CONFIGURATION (STRICTLY PRIVATE)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'farmer-land-documents',
  'farmer-land-documents',
  false, -- Strictly private: No public URLs
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

-- Storage Row-Level Security Policies
-- Folder naming convention: {farmer_auth_uid}/{document_id}/{filename}
DROP POLICY IF EXISTS "farmer_docs_select_own" ON storage.objects;
CREATE POLICY "farmer_docs_select_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'farmer-land-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "farmer_docs_insert_own" ON storage.objects;
CREATE POLICY "farmer_docs_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'farmer-land-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "farmer_docs_delete_own" ON storage.objects;
CREATE POLICY "farmer_docs_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'farmer-land-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2. ENHANCE FARMER_LAND_DOCUMENTS TABLE
ALTER TABLE public.farmer_land_documents
  ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(100) DEFAULT 'farmer-land-documents',
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS file_format VARCHAR(20) DEFAULT 'PDF',
  ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(50) DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS retention_status VARCHAR(50) DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS signature_status VARCHAR(50) DEFAULT 'NO_SIGNATURE_DETECTED',
  ADD COLUMN IF NOT EXISTS farmer_confirmed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS farmer_confirmed_at TIMESTAMPTZ;

-- Constraints for integrity
ALTER TABLE public.farmer_land_documents
  DROP CONSTRAINT IF EXISTS valid_signature_status;
ALTER TABLE public.farmer_land_documents
  ADD CONSTRAINT valid_signature_status CHECK (
    signature_status IN (
      'NO_SIGNATURE_DETECTED',
      'SIGNATURE_PRESENT_UNVERIFIED',
      'DIGITAL_SIGNATURE_VALIDATED',
      'SIGNATURE_INVALID'
    )
  );

ALTER TABLE public.farmer_land_documents
  DROP CONSTRAINT IF EXISTS valid_retention_status;
ALTER TABLE public.farmer_land_documents
  ADD CONSTRAINT valid_retention_status CHECK (
    retention_status IN (
      'ACTIVE',
      'DELETION_REQUESTED',
      'PURGED'
    )
  );

ALTER TABLE public.farmer_land_documents
  DROP CONSTRAINT IF EXISTS valid_extraction_status;
ALTER TABLE public.farmer_land_documents
  ADD CONSTRAINT valid_extraction_status CHECK (
    extraction_status IN (
      'PENDING',
      'SUCCESS',
      'PARTIAL',
      'MANUAL_FALLBACK',
      'FAILED'
    )
  );

-- Index for tenant-isolated storage path lookups
CREATE INDEX IF NOT EXISTS idx_fld_storage_path ON public.farmer_land_documents (storage_path);

-- 3. SEPARATE SOURCE LIFECYCLE FROM AUTHORIZATION IN LAND_DATA_SOURCES
ALTER TABLE public.land_data_sources
  ADD COLUMN IF NOT EXISTS dataset_status VARCHAR(50) DEFAULT 'AVAILABLE';

-- Dharani: Lifecycle = SUPERSEDED, Permission = PENDING_AUTHORIZATION, Dataset = UNAVAILABLE
-- Superseded portal does not mean collection permission is legally prohibited,
-- but scraping remains strictly disabled fail-closed.
UPDATE public.land_data_sources
SET
  legacy_status = 'SUPERSEDED',
  permission_status = 'PENDING_AUTHORIZATION',
  dataset_status = 'UNAVAILABLE',
  scraping_enabled = FALSE,
  permission_notes = 'Historical land portal for Telangana. Superseded by Bhu Bharati under the Telangana Bhu Bharati Act. Lifecycle status is SUPERSEDED. Automated scraping remains fail-closed (scraping_enabled = FALSE).'
WHERE source_code = 'TS_DHARANI';

-- Bhu Bharati: Lifecycle = ACTIVE, Permission = PENDING_AUTHORIZATION, Dataset = AVAILABLE
UPDATE public.land_data_sources
SET
  legacy_status = 'ACTIVE',
  permission_status = 'PENDING_AUTHORIZATION',
  dataset_status = 'AVAILABLE',
  scraping_enabled = FALSE
WHERE source_code = 'TS_BHUBHARATI';

-- Central Data.gov.in: Lifecycle = ACTIVE, Permission = APPROVED (GODL open license), Dataset = NO_DATASET
UPDATE public.land_data_sources
SET
  legacy_status = 'ACTIVE',
  permission_status = 'APPROVED',
  dataset_status = 'NO_DATASET',
  scraping_enabled = FALSE,
  permission_notes = 'Open data platform licensed under Government Open Data License (GODL) v1.0. Dataset status is NO_DATASET because no parcel-level cadastral vector datasets are hosted on the platform.'
WHERE source_code = 'CENTRAL_DATA_GOV_IN';

-- Central DILRMP: Lifecycle = ACTIVE, Permission = PENDING_AUTHORIZATION, Dataset = NO_DATASET
UPDATE public.land_data_sources
SET
  legacy_status = 'ACTIVE',
  permission_status = 'PENDING_AUTHORIZATION',
  dataset_status = 'NO_DATASET',
  scraping_enabled = FALSE,
  permission_notes = 'Central monitoring program dashboard. Does not host individual parcel boundaries or village cadastral files.'
WHERE source_code = 'CENTRAL_DILRMP';
