const rules = require('../data/intakeScreeningRules.json');
function evaluate(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Screening must be an object.');
  const list = (key, options) => {
    const values = input[key] ?? [];
    if (!Array.isArray(values) || values.length > options.length || new Set(values).size !== values.length || values.some(value => !options.some(([id]) => id === value))) throw new Error('Select valid ' + key + '.');
    if (values.includes('none') && values.length > 1 || key === 'exposures' && values.includes('unknown') && values.length > 1) throw new Error('None or unknown cannot be combined with other ' + key + '.');
    return values;
  };
  const symptoms = list('symptoms', rules.symptoms), exposures = list('exposures', rules.exposures);
  const other = input.other_symptom ?? '';
  if (typeof other !== 'string' || other.length > 300) throw new Error('Other symptom must be text of 300 characters or fewer.');
  if (symptoms.includes('other') && !other.trim()) throw new Error('Specify the other reported symptom.');
  if (input.routine_visit != null && typeof input.routine_visit !== 'boolean') throw new Error('Routine visit must be true or false.');
  const has = name => symptoms.includes(name);
  const signs = symptoms.filter(value => value !== 'none');
  const contact = exposures.includes('sick_animal') || exposures.includes('pet_facility');
  const possibleExposure = contact || exposures.includes('recent_travel');
  let triage = 'not_assessed', infection = 'not_assessed';
  const matched = [];
  if (has('difficulty_breathing') || has('bloody_stool') && has('vomiting')) { triage = 'urgent'; matched.push(has('difficulty_breathing') ? 'breathing_difficulty' : 'bloody_stool_with_vomiting'); }
  else if (signs.length || possibleExposure) { triage = 'priority'; matched.push('reported_symptoms_or_exposure'); }
  else if (has('none') && exposures.includes('none')) { triage = 'routine'; matched.push('explicit_negative_screen'); }
  if (has('bloody_stool') && has('vomiting') || has('coughing') && exposures.includes('sick_animal')) { infection = 'possible_infection'; matched.push('infectious_pattern'); }
  else if (possibleExposure) { infection = 'possible_exposure'; matched.push('reported_exposure'); }
  else if (signs.length) { infection = 'needs_assessment'; matched.push('symptoms_need_assessment'); }
  else if (has('none') && exposures.includes('none')) infection = 'not_indicated';
  const suggested = {triage_priority:triage,infection_risk:infection};
  return {inputs:{symptoms,exposures,other_symptom:has('other')?other.trim():'',routine_visit:input.routine_visit===true},rule_version:rules.version,validation_status:rules.validation_status,preliminary:true,matched_rules:matched,suggested,effective:{...suggested},review:null};
}
module.exports = {evaluate, rules};
