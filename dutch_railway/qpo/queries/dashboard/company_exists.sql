SELECT EXISTS (SELECT 1 FROM fact_service WHERE company_name = $1) AS exists;
