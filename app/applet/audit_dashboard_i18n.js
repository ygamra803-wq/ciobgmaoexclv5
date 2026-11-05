const fs = require('fs');
const fr = JSON.parse(fs.readFileSync('src/i18n/translations/fr.json'));
const ar = JSON.parse(fs.readFileSync('src/i18n/translations/ar.json'));
const en = JSON.parse(fs.readFileSync('src/i18n/translations/en.json'));

function getNested(obj, path) {
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

const files = [
  'src/presentation/pages/dashboard/DashboardView.tsx',
  'src/presentation/pages/dashboard/components/DashboardKPIs.tsx'
];

const keysUsed = [];
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  // Match t('key') or t('key', ...)
  const matches = content.matchAll(/t\(\s*['"]([^'"]+)['"]/g);
  for (const m of matches) {
    keysUsed.push({ file, key: m[1] });
  }
});

const uniqueKeys = Array.from(new Set(keysUsed.map(k => k.key)));
console.log('Total unique t() keys found:', uniqueKeys.length);

const missingInFr = uniqueKeys.filter(key => getNested(fr, key) === undefined);
const missingInAr = uniqueKeys.filter(key => getNested(ar, key) === undefined);
const missingInEn = uniqueKeys.filter(key => getNested(en, key) === undefined);

console.log('--- Missing in FR (' + missingInFr.length + ') ---');
console.log(missingInFr);

console.log('--- Missing in AR (' + missingInAr.length + ') ---');
console.log(missingInAr);

console.log('--- Missing in EN (' + missingInEn.length + ') ---');
console.log(missingInEn);
