-- CreateSchema
CREATE SCHEMA IF NOT EXISTS public;

-- CreateTable
CREATE TABLE organizations (
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    logo_url TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    CONSTRAINT organization_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE registration_intents (
    id TEXT NOT NULL,
    slug TEXT NOT NULL,
    practice_name TEXT NOT NULL,
    admin_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    logo_url TEXT NOT NULL,
    paynow_poll_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP(3),

    CONSTRAINT registration_intent_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE subscriptions (
    id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    paynow_reference TEXT,
    status TEXT NOT NULL DEFAULT 'INCOMPLETE',
    current_period_end TIMESTAMP(3),
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    CONSTRAINT subscription_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE branches (
    id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    CONSTRAINT branch_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE users (
    id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    email TEXT,
    password_hash TEXT,
    registration_number TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    is_demo BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    CONSTRAINT user_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE owners (
    id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    alt_mobile TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    is_demo BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    CONSTRAINT owner_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE patients (
    id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    patient_number TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    species TEXT NOT NULL,
    breed TEXT,
    sex TEXT NOT NULL,
    dob TIMESTAMP(3),
    estimated_age TEXT,
    colour TEXT,
    weight DOUBLE PRECISION,
    microchip TEXT,
    spayed_neutered TEXT,
    identifying_marks TEXT,
    photo_path TEXT,
    allergies TEXT,
    clinical_alerts TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    is_demo BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    CONSTRAINT patient_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE suppliers (
    id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    name TEXT NOT NULL,
    contact TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    is_demo BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    CONSTRAINT supplier_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE services (
    id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    taxable BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    duration_minutes INTEGER,
    notes TEXT,
    is_demo BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    CONSTRAINT service_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE service_suggestions (
    id TEXT NOT NULL,
    organization_id TEXT,
    service_id TEXT NOT NULL,
    medication_id TEXT NOT NULL,

    CONSTRAINT service_suggestion_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE medications (
    id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    name TEXT NOT NULL,
    generic_name TEXT,
    category TEXT NOT NULL,
    manufacturer TEXT,
    formulation TEXT,
    strength TEXT,
    unit TEXT NOT NULL,
    pack_size TEXT,
    cost_price DOUBLE PRECISION NOT NULL,
    selling_price DOUBLE PRECISION NOT NULL,
    reorder_level DOUBLE PRECISION NOT NULL,
    supplier_id TEXT,
    prescription_required BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    is_demo BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    CONSTRAINT medication_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE medication_batches (
    id TEXT NOT NULL,
    organization_id TEXT,
    medication_id TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    expiry_date TIMESTAMP(3) NOT NULL,
    supplier_id TEXT,
    received_at TIMESTAMP(3) NOT NULL,
    cost_price DOUBLE PRECISION,
    is_demo BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    CONSTRAINT medication_batch_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE products (
    id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    barcode TEXT,
    name TEXT NOT NULL,
    brand TEXT,
    category TEXT NOT NULL,
    cost_price DOUBLE PRECISION NOT NULL,
    selling_price DOUBLE PRECISION NOT NULL,
    reorder_level DOUBLE PRECISION NOT NULL,
    supplier_id TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    is_demo BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    CONSTRAINT product_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE stock_movements (
    id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    item_id TEXT NOT NULL,
    batch_id TEXT,
    quantity DOUBLE PRECISION NOT NULL,
    movement_type TEXT NOT NULL,
    related_type TEXT,
    related_id TEXT,
    user_id TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT stock_movement_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE visits (
    id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    veterinarian_id TEXT,
    created_by_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    step TEXT NOT NULL DEFAULT 'SERVICE',
    presenting_complaint TEXT,
    history TEXT,
    weight DOUBLE PRECISION,
    temperature DOUBLE PRECISION,
    examination TEXT,
    treatment_notes TEXT,
    clinical_notes TEXT,
    follow_up_date TIMESTAMP(3),
    is_demo BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    CONSTRAINT visit_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE visit_services (
    id TEXT NOT NULL,
    organization_id TEXT,
    visit_id TEXT NOT NULL,
    service_id TEXT NOT NULL,
    name TEXT NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    quantity DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT visit_service_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE visit_medications (
    id TEXT NOT NULL,
    organization_id TEXT,
    visit_id TEXT NOT NULL,
    medication_id TEXT NOT NULL,
    batch_id TEXT,
    name TEXT NOT NULL,
    quantity DOUBLE PRECISION NOT NULL,
    unit_price DOUBLE PRECISION NOT NULL,
    dose TEXT,
    instructions TEXT,
    dispensed BOOLEAN NOT NULL DEFAULT false,
    vaccination_id TEXT,

    CONSTRAINT visit_medication_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE diagnoses (
    id TEXT NOT NULL,
    organization_id TEXT,
    visit_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    label TEXT NOT NULL,
    notes TEXT,
    veterinarian_id TEXT NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT diagnosis_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE vaccinations (
    id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    visit_id TEXT,
    vaccine_name TEXT NOT NULL,
    disease TEXT,
    medication_id TEXT,
    batch_id TEXT,
    batch_number TEXT,
    expiry_date TIMESTAMP(3),
    dose TEXT,
    administered_at TIMESTAMP(3) NOT NULL,
    next_due TIMESTAMP(3),
    veterinarian_id TEXT,
    administered_elsewhere BOOLEAN NOT NULL DEFAULT false,
    external_clinic TEXT,
    external_veterinarian TEXT,
    notes TEXT,
    is_demo BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    CONSTRAINT vaccination_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE prescriptions (
    id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    number TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    visit_id TEXT,
    veterinarian_id TEXT NOT NULL,
    notes TEXT,
    is_demo BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    CONSTRAINT prescription_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE prescription_items (
    id TEXT NOT NULL,
    organization_id TEXT,
    prescription_id TEXT NOT NULL,
    medication_id TEXT,
    medication_name TEXT NOT NULL,
    strength TEXT,
    dose TEXT,
    route TEXT,
    frequency TEXT,
    duration TEXT,
    quantity TEXT,
    instructions TEXT,
    repeats INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT prescription_item_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE sales (
    id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    receipt_number TEXT NOT NULL,
    patient_id TEXT,
    owner_id TEXT,
    visit_id TEXT,
    staff_id TEXT NOT NULL,
    veterinarian_id TEXT,
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    subtotal DOUBLE PRECISION NOT NULL,
    total DOUBLE PRECISION NOT NULL,
    notes TEXT,
    is_demo BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    CONSTRAINT sale_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE sale_items (
    id TEXT NOT NULL,
    organization_id TEXT,
    sale_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    item_id TEXT,
    batch_id TEXT,
    name TEXT NOT NULL,
    quantity DOUBLE PRECISION NOT NULL,
    unit_price DOUBLE PRECISION NOT NULL,
    line_total DOUBLE PRECISION NOT NULL,

    CONSTRAINT sale_item_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE payments (
    id TEXT NOT NULL,
    organization_id TEXT,
    sale_id TEXT NOT NULL,
    method TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    received DOUBLE PRECISION,
    change_given DOUBLE PRECISION,
    reference TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT payment_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE payment_methods (
    id TEXT NOT NULL,
    organization_id TEXT,
    name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT payment_method_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE timeline_events (
    id TEXT NOT NULL,
    organization_id TEXT,
    patient_id TEXT NOT NULL,
    visit_id TEXT,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    occurred_at TIMESTAMP(3) NOT NULL,
    veterinarian_id TEXT,
    related_type TEXT,
    related_id TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT timeline_event_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE audio_notes (
    id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    visit_id TEXT,
    veterinarian_id TEXT,
    local_audio_path TEXT,
    duration INTEGER,
    transcript TEXT,
    processing_status TEXT NOT NULL DEFAULT 'RECORDED',
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP(3),

    CONSTRAINT audio_note_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE notifications (
    id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    href TEXT,
    read_at TIMESTAMP(3),
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT notification_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE audit_logs (
    id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    user_id TEXT,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT audit_log_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE sync_queue (
    id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    idempotency_key TEXT NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP(3),

    CONSTRAINT sync_queue_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE sequences (
    id TEXT NOT NULL,
    organization_id TEXT,
    value INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT sequence_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE clinic_settings (
    id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    clinic_name TEXT NOT NULL,
    tagline TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    currency_symbol TEXT NOT NULL DEFAULT '$',
    tax_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
    lock_timeout_minutes INTEGER NOT NULL DEFAULT 5,
    receipt_footer TEXT,
    supabase_url TEXT,
    supabase_key TEXT,
    sync_enabled BOOLEAN NOT NULL DEFAULT false,
    last_sync_at TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL,

    CONSTRAINT clinic_settings_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE printer_configs (
    id TEXT NOT NULL,
    organization_id TEXT,
    branch_id TEXT NOT NULL,
    document_type TEXT NOT NULL,
    name TEXT NOT NULL,
    adapter TEXT NOT NULL DEFAULT 'BROWSER',
    target TEXT,
    is_default BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT printer_config_pkey PRIMARY KEY (id)
);

-- CreateIndex
CREATE UNIQUE INDEX organization_slug_key ON organizations(slug);

-- CreateIndex
CREATE UNIQUE INDEX registration_intent_slug_key ON registration_intents(slug);

-- CreateIndex
CREATE UNIQUE INDEX registration_intent_paynow_poll_url_key ON registration_intents(paynow_poll_url);

-- CreateIndex
CREATE INDEX registration_intent_email_created_at_idx ON registration_intents(email, created_at);

-- CreateIndex
CREATE UNIQUE INDEX subscription_organization_id_key ON subscriptions(organization_id);

-- CreateIndex
CREATE UNIQUE INDEX subscription_paynow_reference_key ON subscriptions(paynow_reference);

-- CreateIndex
CREATE INDEX subscription_status_current_period_end_idx ON subscriptions(status, current_period_end);

-- CreateIndex
CREATE UNIQUE INDEX user_email_key ON users(email);

-- CreateIndex
CREATE INDEX user_branch_id_active_idx ON users(branch_id, active);

-- CreateIndex
CREATE INDEX owner_full_name_idx ON owners(full_name);

-- CreateIndex
CREATE INDEX owner_mobile_idx ON owners(mobile);

-- CreateIndex
CREATE INDEX patient_name_idx ON patients(name);

-- CreateIndex
CREATE INDEX patient_owner_id_idx ON patients(owner_id);

-- CreateIndex
CREATE INDEX patient_microchip_idx ON patients(microchip);

-- CreateIndex
CREATE UNIQUE INDEX patient_organization_id_patient_number_key ON patients(organization_id, patient_number);

-- CreateIndex
CREATE UNIQUE INDEX service_suggestion_service_id_medication_id_key ON service_suggestions(service_id, medication_id);

-- CreateIndex
CREATE INDEX medication_name_idx ON medications(name);

-- CreateIndex
CREATE INDEX medication_batch_expiry_date_idx ON medication_batches(expiry_date);

-- CreateIndex
CREATE UNIQUE INDEX medication_batch_medication_id_batch_number_key ON medication_batches(medication_id, batch_number);

-- CreateIndex
CREATE INDEX product_name_idx ON products(name);

-- CreateIndex
CREATE INDEX product_barcode_idx ON products(barcode);

-- CreateIndex
CREATE UNIQUE INDEX product_organization_id_sku_key ON products(organization_id, sku);

-- CreateIndex
CREATE INDEX stock_movement_item_type_item_id_idx ON stock_movements(item_type, item_id);

-- CreateIndex
CREATE INDEX stock_movement_batch_id_idx ON stock_movements(batch_id);

-- CreateIndex
CREATE INDEX stock_movement_related_type_related_id_idx ON stock_movements(related_type, related_id);

-- CreateIndex
CREATE INDEX stock_movement_created_at_idx ON stock_movements(created_at);

-- CreateIndex
CREATE INDEX visit_patient_id_created_at_idx ON visits(patient_id, created_at);

-- CreateIndex
CREATE INDEX visit_status_idx ON visits(status);

-- CreateIndex
CREATE INDEX diagnosis_patient_id_idx ON diagnoses(patient_id);

-- CreateIndex
CREATE INDEX vaccination_patient_id_administered_at_idx ON vaccinations(patient_id, administered_at);

-- CreateIndex
CREATE INDEX prescription_patient_id_idx ON prescriptions(patient_id);

-- CreateIndex
CREATE UNIQUE INDEX prescription_organization_id_number_key ON prescriptions(organization_id, number);

-- CreateIndex
CREATE UNIQUE INDEX sale_visit_id_key ON sales(visit_id);

-- CreateIndex
CREATE INDEX sale_created_at_idx ON sales(created_at);

-- CreateIndex
CREATE INDEX sale_staff_id_idx ON sales(staff_id);

-- CreateIndex
CREATE INDEX sale_owner_id_idx ON sales(owner_id);

-- CreateIndex
CREATE UNIQUE INDEX sale_organization_id_receipt_number_key ON sales(organization_id, receipt_number);

-- CreateIndex
CREATE UNIQUE INDEX payment_method_organization_id_name_key ON payment_methods(organization_id, name);

-- CreateIndex
CREATE INDEX timeline_event_patient_id_occurred_at_idx ON timeline_events(patient_id, occurred_at);

-- CreateIndex
CREATE INDEX audio_note_patient_id_idx ON audio_notes(patient_id);

-- CreateIndex
CREATE INDEX notification_user_id_read_at_idx ON notifications(user_id, read_at);

-- CreateIndex
CREATE INDEX notification_created_at_idx ON notifications(created_at);

-- CreateIndex
CREATE INDEX audit_log_created_at_idx ON audit_logs(created_at);

-- CreateIndex
CREATE INDEX audit_log_entity_entity_id_idx ON audit_logs(entity, entity_id);

-- CreateIndex
CREATE INDEX audit_log_action_idx ON audit_logs(action);

-- CreateIndex
CREATE UNIQUE INDEX sync_queue_idempotency_key_key ON sync_queue(idempotency_key);

-- CreateIndex
CREATE INDEX sync_queue_status_idx ON sync_queue(status);

-- CreateIndex
CREATE UNIQUE INDEX printer_config_branch_id_document_type_key ON printer_configs(branch_id, document_type);

-- AddForeignKey
ALTER TABLE subscriptions ADD CONSTRAINT subscription_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE branches ADD CONSTRAINT branch_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE patients ADD CONSTRAINT patient_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE service_suggestions ADD CONSTRAINT service_suggestion_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE service_suggestions ADD CONSTRAINT service_suggestion_medication_id_fkey FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE medications ADD CONSTRAINT medication_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE medication_batches ADD CONSTRAINT medication_batch_medication_id_fkey FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE medication_batches ADD CONSTRAINT medication_batch_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE products ADD CONSTRAINT product_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE visits ADD CONSTRAINT visit_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE visit_services ADD CONSTRAINT visit_service_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE visit_services ADD CONSTRAINT visit_service_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE visit_medications ADD CONSTRAINT visit_medication_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE diagnoses ADD CONSTRAINT diagnosis_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE vaccinations ADD CONSTRAINT vaccination_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE vaccinations ADD CONSTRAINT vaccination_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE prescriptions ADD CONSTRAINT prescription_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE prescriptions ADD CONSTRAINT prescription_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE prescription_items ADD CONSTRAINT prescription_item_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE sales ADD CONSTRAINT sale_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE sales ADD CONSTRAINT sale_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE sales ADD CONSTRAINT sale_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE sale_items ADD CONSTRAINT sale_item_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE payments ADD CONSTRAINT payment_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE timeline_events ADD CONSTRAINT timeline_event_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE audio_notes ADD CONSTRAINT audio_note_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep all data server-only; the application uses the Supabase service role from server code.
GRANT USAGE ON SCHEMA public TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.organizations TO service_role;
ALTER TABLE public.registration_intents ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.registration_intents TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.subscriptions TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.branches TO service_role;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.users TO service_role;
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.owners TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.patients TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.suppliers TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.services TO service_role;
ALTER TABLE public.service_suggestions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.service_suggestions TO service_role;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.medications TO service_role;
ALTER TABLE public.medication_batches ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.medication_batches TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.products TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.stock_movements TO service_role;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.visits TO service_role;
ALTER TABLE public.visit_services ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.visit_services TO service_role;
ALTER TABLE public.visit_medications ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.visit_medications TO service_role;
ALTER TABLE public.diagnoses ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.diagnoses TO service_role;
ALTER TABLE public.vaccinations ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.vaccinations TO service_role;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.prescriptions TO service_role;
ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.prescription_items TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.sales TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.sale_items TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.payments TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.payment_methods TO service_role;
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.timeline_events TO service_role;
ALTER TABLE public.audio_notes ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.audio_notes TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.notifications TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.audit_logs TO service_role;
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.sync_queue TO service_role;
ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.sequences TO service_role;
ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.clinic_settings TO service_role;
ALTER TABLE public.printer_configs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.printer_configs TO service_role;
