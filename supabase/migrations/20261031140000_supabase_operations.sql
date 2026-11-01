CREATE OR REPLACE FUNCTION public.remove_demo_data(p_organization_id text, p_branch_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_ids text[];
  v_visit_ids text[];
  v_sale_ids text[];
  v_prescription_ids text[];
  v_medication_ids text[];
  v_product_ids text[];
  v_service_ids text[];
BEGIN
  SELECT COALESCE(array_agg(id), ARRAY[]::text[]) INTO v_patient_ids
  FROM patients WHERE organization_id = p_organization_id AND branch_id = p_branch_id AND is_demo = true;
  SELECT COALESCE(array_agg(id), ARRAY[]::text[]) INTO v_visit_ids
  FROM visits WHERE organization_id = p_organization_id AND branch_id = p_branch_id AND is_demo = true;
  SELECT COALESCE(array_agg(id), ARRAY[]::text[]) INTO v_sale_ids
  FROM sales WHERE organization_id = p_organization_id AND branch_id = p_branch_id AND is_demo = true;
  SELECT COALESCE(array_agg(id), ARRAY[]::text[]) INTO v_prescription_ids
  FROM prescriptions WHERE organization_id = p_organization_id AND branch_id = p_branch_id AND is_demo = true;
  SELECT COALESCE(array_agg(id), ARRAY[]::text[]) INTO v_medication_ids
  FROM medications WHERE organization_id = p_organization_id AND branch_id = p_branch_id AND is_demo = true;
  SELECT COALESCE(array_agg(id), ARRAY[]::text[]) INTO v_product_ids
  FROM products WHERE organization_id = p_organization_id AND branch_id = p_branch_id AND is_demo = true;
  SELECT COALESCE(array_agg(id), ARRAY[]::text[]) INTO v_service_ids
  FROM services WHERE organization_id = p_organization_id AND branch_id = p_branch_id AND is_demo = true;

  DELETE FROM payments WHERE organization_id = p_organization_id AND sale_id = ANY(v_sale_ids);
  DELETE FROM sale_items WHERE organization_id = p_organization_id AND sale_id = ANY(v_sale_ids);
  DELETE FROM sales WHERE id = ANY(v_sale_ids);
  DELETE FROM prescription_items WHERE organization_id = p_organization_id AND prescription_id = ANY(v_prescription_ids);
  DELETE FROM prescriptions WHERE id = ANY(v_prescription_ids);
  DELETE FROM vaccinations
    WHERE organization_id = p_organization_id AND
      (is_demo = true OR patient_id = ANY(v_patient_ids) OR visit_id = ANY(v_visit_ids));
  DELETE FROM timeline_events
    WHERE organization_id = p_organization_id AND (patient_id = ANY(v_patient_ids) OR visit_id = ANY(v_visit_ids));
  DELETE FROM diagnoses
    WHERE organization_id = p_organization_id AND (patient_id = ANY(v_patient_ids) OR visit_id = ANY(v_visit_ids));
  DELETE FROM visit_medications WHERE organization_id = p_organization_id AND visit_id = ANY(v_visit_ids);
  DELETE FROM visit_services WHERE organization_id = p_organization_id AND visit_id = ANY(v_visit_ids);
  DELETE FROM visits WHERE id = ANY(v_visit_ids);
  DELETE FROM stock_movements
    WHERE organization_id = p_organization_id AND
      ((item_type = 'MEDICATION' AND item_id = ANY(v_medication_ids)) OR
       (item_type = 'PRODUCT' AND item_id = ANY(v_product_ids)) OR
       (related_type = 'SALE' AND related_id = ANY(v_sale_ids)));
  DELETE FROM service_suggestions WHERE organization_id = p_organization_id AND service_id = ANY(v_service_ids);
  DELETE FROM medication_batches
    WHERE organization_id = p_organization_id AND (is_demo = true OR medication_id = ANY(v_medication_ids));
  DELETE FROM medications WHERE id = ANY(v_medication_ids);
  DELETE FROM products WHERE id = ANY(v_product_ids);
  DELETE FROM services WHERE id = ANY(v_service_ids);
  DELETE FROM patients WHERE id = ANY(v_patient_ids);
  DELETE FROM owners
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id AND is_demo = true;
  DELETE FROM suppliers
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id AND is_demo = true;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_demo_data(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_demo_data(text, text) TO service_role;
