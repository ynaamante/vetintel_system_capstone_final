const item = (category, name, price, item_type, unit, description) => ({
  category, name, price, item_type, unit, description,
});

const additionalClinicCatalog = [
  // Vaccination (all prices per dose unless noted)
  item('Vaccination', 'Dog 5-in-1 Vaccine', 600, 'vaccination', 'dose', 'Per dose. Veterinarian selects vaccine based on age, health, and vaccination history.'),
  item('Vaccination', 'Dog 6-in-1 Vaccine', 750, 'vaccination', 'dose', 'Per dose. Veterinarian selects vaccine based on age, health, and vaccination history.'),
  item('Vaccination', 'Dog 8-in-1 Vaccine', 800, 'vaccination', 'dose', 'Per dose. Veterinarian selects vaccine based on age, health, and vaccination history.'),
  item('Vaccination', 'Kennel Cough (Bordetella) Vaccine', 800, 'vaccination', 'dose', 'Per dose. Veterinarian selects vaccine based on age, health, and vaccination history.'),
  item('Vaccination', 'Cat 3-in-1 (Tricat) Vaccine', 1000, 'vaccination', 'dose', 'Per dose. Veterinarian selects vaccine based on age, health, and vaccination history.'),
  item('Vaccination', 'Cat 4-in-1 (FVRCP) Vaccine', 800, 'vaccination', 'dose', 'Per dose. Veterinarian selects vaccine based on age, health, and vaccination history.'),
  item('Vaccination', 'Feline Leukemia (FeLV) Vaccine', 1000, 'vaccination', 'dose', 'Per dose. Veterinarian selects vaccine based on age, health, and vaccination history.'),
  item('Vaccination', 'Puppy/Kitten Vaccine Booster Visit', 600, 'consultation', 'visit', 'Sample service fee. State whether the vaccine itself is included.'),
  item('Vaccination', 'Vaccination Card Replacement', 50, 'treatment', 'card', 'Replacement vaccination card fee; no vaccine dose included.'),

  // Treatment administration and procedures
  item('Treatment', 'Wound Cleaning and Dressing', 500, 'treatment', 'procedure', 'Starting service fee; medicines, dressings, and consumables billed separately.'),
  item('Treatment', 'Wound Suturing — Minor', 1500, 'treatment', 'procedure', 'Starting procedure fee; medicines and consumables billed separately.'),
  item('Treatment', 'Abscess Cleaning and Drainage', 1000, 'treatment', 'procedure', 'Starting procedure fee; medicines and consumables billed separately.'),
  item('Treatment', 'Injectable Medication Administration', 250, 'treatment', 'administration', 'Administration fee only; medication billed separately.'),
  item('Treatment', 'Intravenous (IV) Fluid Administration Setup', 500, 'treatment', 'setup', 'Setup fee only; fluids, medicines, and consumables billed separately.'),
  item('Treatment', 'Subcutaneous Fluid Administration', 350, 'treatment', 'administration', 'Administration fee only; fluids and consumables billed separately.'),
  item('Treatment', 'Ear Medication Administration', 250, 'treatment', 'administration', 'Administration fee only; medication billed separately.'),
  item('Treatment', 'Eye Irrigation', 300, 'treatment', 'procedure', 'Per procedure; medication and consumables billed separately.'),
  item('Treatment', 'Bandage Application or Replacement', 350, 'treatment', 'procedure', 'Application fee; bandages and other consumables billed separately.'),
  item('Treatment', 'Minor Skin Irritation Treatment', 500, 'treatment', 'service', 'Starting service fee; medicines and consumables billed separately.'),
  item('Treatment', 'Tick and Flea Treatment Application', 350, 'treatment', 'application', 'Application fee only; tick and flea product billed separately.'),
  item('Treatment', 'Deworming Administration — Small Pet', 200, 'treatment', 'administration', 'Administration fee only; deworming medicine billed separately.'),
  item('Treatment', 'Deworming Administration — Medium Pet', 300, 'treatment', 'administration', 'Administration fee only; deworming medicine billed separately.'),
  item('Treatment', 'Deworming Administration — Large Pet', 400, 'treatment', 'administration', 'Administration fee only; deworming medicine billed separately.'),

  // Dental
  item('Dental', 'Dental Examination', 300, 'treatment', 'visit', 'Examination fee; procedures, anesthesia, and imaging billed separately.'),
  item('Dental', 'Tooth Extraction — Simple', 1000, 'treatment', 'procedure', 'Starting procedure fee; anesthesia and additional equipment may cost extra.'),
  item('Dental', 'Tooth Extraction — Surgical', 2500, 'treatment', 'procedure', 'Starting procedure fee; anesthesia and additional equipment may cost extra.'),
  item('Dental', 'Dental Polishing', 800, 'treatment', 'procedure', 'Procedure fee; anesthesia and additional procedures may cost extra.'),
  item('Dental', 'Oral Mass Examination', 500, 'treatment', 'examination', 'Examination fee; biopsy, histopathology, and treatment billed separately.'),
  item('Dental', 'Dental X-ray', 1500, 'lab_test', 'imaging package', 'Imaging fee; anesthesia or additional equipment may cost extra.'),
  item('Dental', 'Post-Dental Follow-up', 300, 'consultation', 'visit', 'Follow-up visit fee; medicines and additional procedures billed separately.'),

  // Grooming
  item('Grooming', 'Basic Bath — Small Dog', 350, 'treatment', 'session', 'Suggested price; may vary with coat condition, breed, size, and behavior.'),
  item('Grooming', 'Basic Bath — Medium Dog', 500, 'treatment', 'session', 'Suggested price; may vary with coat condition, breed, size, and behavior.'),
  item('Grooming', 'Basic Bath — Large Dog', 700, 'treatment', 'session', 'Suggested price; may vary with coat condition, breed, size, and behavior.'),
  item('Grooming', 'Full Grooming — Small Dog', 600, 'treatment', 'session', 'Suggested price; may vary with coat condition, breed, size, and behavior.'),
  item('Grooming', 'Full Grooming — Medium Dog', 800, 'treatment', 'session', 'Suggested price; may vary with coat condition, breed, size, and behavior.'),
  item('Grooming', 'Full Grooming — Large Dog', 1200, 'treatment', 'session', 'Suggested price; may vary with coat condition, breed, size, and behavior.'),
  item('Grooming', 'Cat Bath and Grooming', 700, 'treatment', 'session', 'Suggested price; may vary with coat condition, breed, size, and behavior.'),
  item('Grooming', 'Sanitary Trim', 250, 'treatment', 'session', 'Suggested price; may vary with coat condition and behavior.'),
  item('Grooming', 'Paw Pad Trimming', 150, 'treatment', 'session', 'Suggested price; may vary with coat condition and behavior.'),
  item('Grooming', 'Coat Dematting', 300, 'treatment', 'session', 'Starting price; veterinary assessment may be needed for severe matting or distress.'),
  item('Grooming', 'Anal Gland Expression', 300, 'treatment', 'session', 'Per session; veterinary assessment may be required.'),

  // Laboratory and diagnostics (excluding tests already in the existing catalog)
  item('Laboratory', 'Complete Blood Count (CBC)', 1000, 'lab_test', 'test', 'Suggested price; equipment, kits, and laboratory charges may change the actual price.'),
  item('Laboratory', 'Blood Chemistry Panel', 1500, 'lab_test', 'panel', 'Suggested price; equipment, kits, and laboratory charges may change the actual price.'),
  item('Laboratory', 'Basic Urinalysis', 400, 'lab_test', 'test', 'Suggested price; confirm included laboratory work.'),
  item('Laboratory', 'Fecalysis / Stool Examination', 350, 'lab_test', 'test', 'Suggested price; confirm included laboratory work.'),
  item('Laboratory', 'Heartworm Rapid Test', 900, 'lab_test', 'test', 'Suggested price; test kit costs may change the actual price.'),
  item('Laboratory', 'Parvovirus Rapid Test', 800, 'lab_test', 'test', 'Suggested price; test kit costs may change the actual price.'),
  item('Laboratory', 'Canine Distemper Rapid Test', 900, 'lab_test', 'test', 'Suggested price; test kit costs may change the actual price.'),
  item('Laboratory', 'Feline Panleukopenia Rapid Test', 800, 'lab_test', 'test', 'Suggested price; test kit costs may change the actual price.'),
  item('Laboratory', 'Feline Immunodeficiency Virus (FIV) Test', 1000, 'lab_test', 'test', 'Suggested price; test kit costs may change the actual price.'),
  item('Laboratory', 'Feline Leukemia Virus (FeLV) Test', 1000, 'lab_test', 'test', 'Suggested price; test kit costs may change the actual price.'),
  item('Laboratory', 'Pregnancy Ultrasound', 1500, 'lab_test', 'scan', 'Suggested price; equipment and imaging inclusions may change the actual price.'),
  item('Laboratory', 'General Abdominal Ultrasound', 2000, 'lab_test', 'scan', 'Suggested price; equipment and imaging inclusions may change the actual price.'),
  item('Laboratory', 'Blood Typing', 1500, 'lab_test', 'test', 'Suggested price; confirm included laboratory work.'),

  // Consultation
  item('Consultation', 'General Wellness Check-up', 500, 'consultation', 'visit', 'Per visit; avoid a separate fee when included in a package.'),
  item('Consultation', 'Puppy / Kitten First Consultation', 500, 'consultation', 'visit', 'Per visit; avoid a separate fee when included in a package.'),
  item('Consultation', 'Follow-up Consultation', 300, 'consultation', 'visit', 'Per visit; avoid a separate fee when included in a package.'),
  item('Consultation', 'Skin and Coat Consultation', 600, 'consultation', 'visit', 'Per visit; avoid a separate fee when included in a package.'),
  item('Consultation', 'Nutrition Consultation', 500, 'consultation', 'visit', 'Per visit; avoid a separate fee when included in a package.'),
  item('Consultation', 'Senior Pet Wellness Consultation', 700, 'consultation', 'visit', 'Per visit; avoid a separate fee when included in a package.'),
  item('Consultation', 'Second Opinion Consultation', 800, 'consultation', 'visit', 'Per visit; avoid a separate fee when included in a package.'),

  // Surgery starting estimates
  item('Surgery', 'Male Cat Neutering', 2000, 'treatment', 'procedure', 'Starting estimate; pre-surgical tests, anesthesia, medicines, monitoring, and hospitalization may be extra.'),
  item('Surgery', 'Female Cat Spaying', 3500, 'treatment', 'procedure', 'Starting estimate; pre-surgical tests, anesthesia, medicines, monitoring, and hospitalization may be extra.'),
  item('Surgery', 'Male Dog Neutering — Small', 3500, 'treatment', 'procedure', 'Starting estimate; weight and condition affect price. Pre-surgical tests and care may be extra.'),
  item('Surgery', 'Female Dog Spaying — Small', 5000, 'treatment', 'procedure', 'Starting estimate; weight and condition affect price. Pre-surgical tests and care may be extra.'),
  item('Surgery', 'Female Dog Spaying — Large', 8000, 'treatment', 'procedure', 'Starting estimate; weight and condition affect price. Pre-surgical tests and care may be extra.'),
  item('Surgery', 'Caesarean Section (C-section)', 10000, 'treatment', 'procedure', 'Starting estimate; weight and condition affect price. Pre-surgical tests and care may be extra.'),
  item('Surgery', 'Pyometra Surgery', 10000, 'treatment', 'procedure', 'Starting estimate; weight and condition affect price. Pre-surgical tests and care may be extra.'),
  item('Surgery', 'Retained Testicle Surgery', 5000, 'treatment', 'procedure', 'Starting estimate; weight and condition affect price. Pre-surgical tests and care may be extra.'),
  item('Surgery', 'Surgical Wound Repair', 3000, 'treatment', 'procedure', 'Starting estimate; pre-surgical tests, anesthesia, medicines, and consumables may be extra.'),

  // Confinement and hospital care
  item('Confinement', 'Standard Confinement — Per Day', 1200, 'inpatient', 'day', 'Per day; specify whether medication, food, fluids, oxygen, and nursing care are included.'),
  item('Confinement', 'Isolation Confinement — Per Day', 2000, 'inpatient', 'day', 'Per day; specify whether medication, food, fluids, oxygen, and nursing care are included.'),
  item('Confinement', 'Oxygen Support — Per Hour', 500, 'treatment', 'hour', 'Per hour; state whether oxygen supplies and monitoring are included.'),
  item('Confinement', 'IV Fluid Monitoring — Per Session', 500, 'treatment', 'session', 'Per session; IV fluids, medicines, and consumables may be separate.'),
  item('Confinement', 'Overnight Patient Monitoring', 800, 'treatment', 'night', 'Per night; specify whether nursing care, food, and supplies are included.'),
  item('Confinement', 'Hospitalization Discharge Assessment', 300, 'consultation', 'assessment', 'Discharge assessment fee; medicines and additional procedures billed separately.'),

  // General services. Emergency stabilization is distinct from the existing emergency assessment fee.
  item('General', 'Pet Microchipping', 1000, 'treatment', 'procedure', 'Suggested price; confirm whether microchip product is included.'),
  item('General', 'Veterinary Health Certificate', 500, 'consultation', 'certificate', 'Certificate fee; examinations and laboratory tests may be separate.'),
  item('General', 'Vaccination Certificate', 150, 'consultation', 'certificate', 'Certificate fee; vaccine dose not included.'),
  item('General', 'Medical Record Copy', 100, 'consultation', 'copy', 'Per copy.'),
  item('General', 'Prescription / Medication Review', 300, 'consultation', 'review', 'Review fee; medicines billed separately.'),
  item('General', 'Pet Weight Assessment', 100, 'consultation', 'assessment', 'Per assessment.'),
  item('General', 'Home Visit — Basic Assessment', 1500, 'consultation', 'visit', 'Starting fee; travel and additional services may be billed separately.'),
  item('General', 'Emergency Stabilization Fee', 1500, 'consultation', 'assessment', 'Separate emergency stabilization service; do not combine with the emergency assessment fee unless both services were provided.'),
];

module.exports = additionalClinicCatalog;
