CREATE OR REPLACE FUNCTION public.create_sale(
  p_sale_id text,
  p_organization_id text,
  p_branch_id text,
  p_staff_id text,
  p_veterinarian_id text,
  p_patient_id text,
  p_owner_id text,
  p_visit_id text,
  p_lines jsonb,
  p_method text,
  p_received double precision,
  p_reference text,
  p_notes text,
  p_timeline_title text,
  p_timeline_summary text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line record;
  v_settings clinic_settings%ROWTYPE;
  v_payment_method payment_methods%ROWTYPE;
  v_seq integer;
  v_receipt text;
  v_subtotal double precision := 0;
  v_tax double precision := 0;
  v_total double precision := 0;
  v_received double precision := 0;
  v_change double precision := 0;
  v_sale sales%ROWTYPE;
  v_patient_name text := 'Walk-in';
  v_service_count double precision := 0;
  v_item_count double precision := 0;
BEGIN
  SELECT * INTO v_sale FROM sales
    WHERE id = p_sale_id AND organization_id = p_organization_id;
  IF FOUND THEN
    RETURN to_jsonb(v_sale);
  END IF;

  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Add at least one item.';
  END IF;
  SELECT * INTO v_payment_method FROM payment_methods
    WHERE name = p_method AND active = true
      AND (organization_id = p_organization_id OR organization_id IS NULL)
    ORDER BY organization_id NULLS LAST LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Choose a payment method.'; END IF;

  SELECT * INTO v_settings FROM clinic_settings WHERE organization_id = p_organization_id LIMIT 1;

  FOR v_line IN
    SELECT * FROM jsonb_to_recordset(p_lines) AS line(
      item_type text, item_id text, batch_id text, name text,
      quantity double precision, unit_price double precision, skip_stock boolean
    )
  LOOP
    IF v_line.quantity IS NULL OR v_line.quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be greater than zero.';
    END IF;
    v_subtotal := v_subtotal + round(v_line.unit_price * v_line.quantity, 2);
    v_item_count := v_item_count + v_line.quantity;
    IF v_line.item_type IN ('SERVICE', 'CUSTOM') THEN v_service_count := v_service_count + v_line.quantity; END IF;

    IF v_line.item_type = 'SERVICE' THEN
      IF EXISTS (
        SELECT 1 FROM services WHERE id = v_line.item_id
          AND organization_id = p_organization_id AND taxable = true
      ) THEN
        v_tax := v_tax + v_line.unit_price * v_line.quantity * COALESCE(v_settings.tax_rate, 0);
      END IF;
    ELSIF v_line.item_type = 'MEDICATION' AND NOT COALESCE(v_line.skip_stock, false) THEN
      IF v_line.batch_id IS NULL THEN RAISE EXCEPTION '% needs a batch.', v_line.name; END IF;
      IF NOT EXISTS (
        SELECT 1 FROM medication_batches
        WHERE id = v_line.batch_id AND medication_id = v_line.item_id
          AND organization_id = p_organization_id AND expiry_date::date >= CURRENT_DATE
      ) THEN
        RAISE EXCEPTION '% batch is invalid or expired.', v_line.name;
      END IF;
      IF COALESCE((SELECT sum(quantity) FROM stock_movements
          WHERE organization_id = p_organization_id AND item_type = 'MEDICATION'
            AND item_id = v_line.item_id AND batch_id = v_line.batch_id), 0) < v_line.quantity THEN
        RAISE EXCEPTION 'Not enough stock for %.', v_line.name;
      END IF;
    ELSIF v_line.item_type = 'PRODUCT' THEN
      IF COALESCE((SELECT sum(quantity) FROM stock_movements
          WHERE organization_id = p_organization_id AND item_type = 'PRODUCT'
            AND item_id = v_line.item_id AND batch_id IS NULL), 0) < v_line.quantity THEN
        RAISE EXCEPTION 'Not enough stock for %.', v_line.name;
      END IF;
    END IF;
  END LOOP;

  v_subtotal := round(v_subtotal, 2);
  v_tax := round(v_tax, 2);
  v_total := round(v_subtotal + v_tax, 2);
  v_received := CASE WHEN p_method = 'Cash' THEN round(COALESCE(p_received, 0), 2) ELSE v_total END;
  IF p_method = 'Cash' AND v_received + 0.001 < v_total THEN
    RAISE EXCEPTION 'Amount received is less than the total.';
  END IF;
  v_change := CASE WHEN p_method = 'Cash' THEN round(v_received - v_total, 2) ELSE 0 END;
  v_seq := public.next_sequence(p_organization_id, 'RECEIPT');
  v_receipt := 'R' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || lpad(v_seq::text, 4, '0');

  INSERT INTO sales (
    id, organization_id, branch_id, receipt_number, patient_id, owner_id, visit_id,
    staff_id, veterinarian_id, status, subtotal, total, notes, created_at, updated_at
  ) VALUES (
    p_sale_id, p_organization_id, p_branch_id, v_receipt, p_patient_id, p_owner_id, p_visit_id,
    p_staff_id, p_veterinarian_id, 'COMPLETED', v_subtotal, v_total, p_notes, now(), now()
  ) RETURNING * INTO v_sale;

  FOR v_line IN
    SELECT * FROM jsonb_to_recordset(p_lines) AS line(
      item_type text, item_id text, batch_id text, name text,
      quantity double precision, unit_price double precision, skip_stock boolean
    )
  LOOP
    INSERT INTO sale_items (
      id, organization_id, sale_id, item_type, item_id, batch_id, name, quantity, unit_price, line_total
    ) VALUES (
      gen_random_uuid()::text, p_organization_id, p_sale_id, v_line.item_type, NULLIF(v_line.item_id, ''),
      v_line.batch_id, v_line.name, v_line.quantity, round(v_line.unit_price, 2),
      round(v_line.unit_price * v_line.quantity, 2)
    );
    IF v_line.item_type IN ('MEDICATION', 'PRODUCT') AND NOT COALESCE(v_line.skip_stock, false) THEN
      INSERT INTO stock_movements (
        id, organization_id, branch_id, item_type, item_id, batch_id, quantity,
        movement_type, related_type, related_id, user_id, reason
      ) VALUES (
        gen_random_uuid()::text, p_organization_id, p_branch_id, v_line.item_type, v_line.item_id,
        CASE WHEN v_line.item_type = 'MEDICATION' THEN v_line.batch_id ELSE NULL END,
        -v_line.quantity, 'SOLD', 'SALE', p_sale_id, p_staff_id, v_receipt
      );
    END IF;
  END LOOP;

  INSERT INTO payments (id, organization_id, sale_id, method, amount, received, change_given, reference)
  VALUES (gen_random_uuid()::text, p_organization_id, p_sale_id, p_method, v_total, v_received, v_change, NULLIF(trim(p_reference), ''));

  IF p_patient_id IS NOT NULL THEN
    SELECT name INTO v_patient_name FROM patients WHERE id = p_patient_id AND organization_id = p_organization_id;
    INSERT INTO timeline_events (
      id, organization_id, patient_id, visit_id, event_type, title, summary, occurred_at,
      veterinarian_id, related_type, related_id
    ) VALUES (
      gen_random_uuid()::text, p_organization_id, p_patient_id, p_visit_id,
      CASE WHEN p_visit_id IS NULL THEN 'SALE' ELSE 'VISIT' END,
      COALESCE(NULLIF(p_timeline_title, ''), CASE WHEN p_visit_id IS NULL THEN 'Sale' ELSE 'Consultation' END),
      COALESCE(NULLIF(p_timeline_summary, ''), v_receipt), now(),
      p_veterinarian_id, 'Sale', p_sale_id
    );
  END IF;

  INSERT INTO audit_logs (id, organization_id, branch_id, user_id, action, entity, entity_id, details)
  VALUES (
    gen_random_uuid()::text, p_organization_id, p_branch_id, p_staff_id, 'SALE', 'Sale', p_sale_id,
    jsonb_build_object('receiptNumber', v_receipt, 'total', v_total, 'method', p_method)::text
  );

  INSERT INTO notifications (id, organization_id, branch_id, user_id, title, body, href)
  SELECT gen_random_uuid()::text, p_organization_id, p_branch_id, u.id, 'Completed',
    v_patient_name || ' (' || COALESCE(NULLIF(v_service_count, 0), v_item_count)::text || ') - ' ||
      COALESCE(v_settings.currency_symbol, '$') || to_char(v_total, 'FM999999999990.00'),
    '/sales/' || p_sale_id
  FROM users u
  WHERE u.organization_id = p_organization_id AND u.branch_id = p_branch_id
    AND u.active = true AND u.role IN ('ADMIN', 'SUPER_ADMIN') AND u.id <> p_staff_id;

  IF p_visit_id IS NOT NULL THEN
    UPDATE visits SET status = 'COMPLETED', step = 'COMPLETE', veterinarian_id = p_veterinarian_id, updated_at = now()
      WHERE id = p_visit_id AND organization_id = p_organization_id AND status = 'DRAFT';
    IF NOT FOUND THEN RAISE EXCEPTION 'This visit is already complete.'; END IF;
  END IF;

  RETURN to_jsonb(v_sale);
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_sale(
  p_sale_id text,
  p_organization_id text,
  p_branch_id text,
  p_user_id text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale sales%ROWTYPE;
BEGIN
  IF trim(COALESCE(p_reason, '')) = '' THEN RAISE EXCEPTION 'A reason is required to refund.'; END IF;
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id AND organization_id = p_organization_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found.'; END IF;
  IF v_sale.status = 'REFUNDED' THEN RAISE EXCEPTION 'This sale is already refunded.'; END IF;

  UPDATE sales SET status = 'REFUNDED', updated_at = now() WHERE id = p_sale_id AND organization_id = p_organization_id;
  INSERT INTO stock_movements (
    id, organization_id, branch_id, item_type, item_id, batch_id, quantity,
    movement_type, related_type, related_id, user_id, reason
  )
  SELECT gen_random_uuid()::text, p_organization_id, p_branch_id, item_type, item_id, batch_id, -sm.quantity,
    'REFUND', 'SALE', p_sale_id, p_user_id, trim(p_reason)
  FROM stock_movements sm
  WHERE sm.organization_id = p_organization_id AND sm.related_type = 'SALE'
    AND sm.related_id = p_sale_id AND sm.movement_type = 'SOLD';

  INSERT INTO audit_logs (id, organization_id, branch_id, user_id, action, entity, entity_id, details)
  VALUES (gen_random_uuid()::text, p_organization_id, p_branch_id, p_user_id, 'REFUND', 'Sale', p_sale_id,
    jsonb_build_object('receiptNumber', v_sale.receipt_number, 'reason', trim(p_reason))::text);
  RETURN to_jsonb(v_sale);
END;
$$;

REVOKE ALL ON FUNCTION public.create_sale(text, text, text, text, text, text, text, text, jsonb, text, double precision, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_sale(text, text, text, text, text, text, text, text, jsonb, text, double precision, text, text, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.refund_sale(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_sale(text, text, text, text, text) TO service_role;
