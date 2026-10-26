# Abubeker Medresa · Registration Desk 2019
npm install && npm run dev   (optionally copy .env.example to .env)
Expected tables: students(id, created_at, name_am, name_en, gender, dob, school_level, level_id, academic_year,
last_page_learnt, has_tutor, tutor_days, tutor_arrival_time, is_yetim) and
student_private(student_id, parent_name, parent_phone, subcity, woreda, block, house_no, emergency_contact, medical_notes, notes).
Adjust the two insert() calls in src/App.tsx if your column names differ. RLS must allow anon insert/select on both tables.
