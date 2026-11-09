// Laboratory examinations, grouped by the condition being investigated.
module.exports = [
  ['Canine Parvoviral Enteritis', ['Canine Parvovirus Antigen Test', 'Parvovirus PCR']],
  ['Canine Distemper', ['Canine Distemper Antigen Test', 'CDV PCR']],
  ['Leptospirosis', ['Leptospira PCR', 'Leptospira MAT']],
  ['Kennel Cough / CIRDC', ['Canine Respiratory Pathogen PCR Panel']],
  ['Rabies', ['Rabies Diagnostic Test (authorized laboratory)']],
  ['Giardiasis', ['Giardia Antigen Test', 'Fecal Examination']],
  ['Feline Panleukopenia', ['Feline Panleukopenia Antigen Test', 'FPV PCR']],
  ['Feline Herpesvirus', ['FHV-1 PCR']],
  ['Feline Calicivirus', ['FCV PCR']],
  ['FeLV', ['Feline Leukemia Virus Antigen Test']],
  ['FIV', ['Feline Immunodeficiency Virus Antibody Test']],
  ['Ehrlichiosis', ['Ehrlichia Antibody Test', 'Ehrlichia PCR']],
  ['Babesiosis', ['Blood Smear Examination', 'Babesia PCR']],
  ['Dermatophytosis', ['Fungal Culture', 'Dermatophyte PCR']],
].flatMap(([disease, names]) => names.map(name => ({ name, disease })));
