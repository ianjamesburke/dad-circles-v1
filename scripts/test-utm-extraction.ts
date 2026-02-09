/**
 * Quick test script for UTM parameter extraction logic
 * Run with: npx tsx scripts/test-utm-extraction.ts
 */

// Simulate the server-side UTM extraction logic from callable.ts
function extractUtmParams(rawUtm: unknown): Record<string, string> | undefined {
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const utm: Record<string, string> = {};
  
  if (rawUtm && typeof rawUtm === 'object') {
    for (const key of utmKeys) {
      const value = (rawUtm as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.length <= 200) {
        utm[key] = value.trim();
      }
    }
  }
  
  return Object.keys(utm).length > 0 ? utm : undefined;
}

// Test cases
const tests = [
  {
    name: 'Valid UTM params',
    input: { utm_source: 'facebook', utm_medium: 'cpc', utm_campaign: 'spring2026' },
    expected: { utm_source: 'facebook', utm_medium: 'cpc', utm_campaign: 'spring2026' },
  },
  {
    name: 'Empty object',
    input: {},
    expected: undefined,
  },
  {
    name: 'Null input',
    input: null,
    expected: undefined,
  },
  {
    name: 'Undefined input',
    input: undefined,
    expected: undefined,
  },
  {
    name: 'Non-string values filtered out',
    input: { utm_source: 'facebook', utm_medium: 123, utm_campaign: null },
    expected: { utm_source: 'facebook' },
  },
  {
    name: 'Unknown keys filtered out',
    input: { utm_source: 'facebook', malicious_key: 'bad', __proto__: 'attack' },
    expected: { utm_source: 'facebook' },
  },
  {
    name: 'Whitespace trimmed',
    input: { utm_source: '  facebook  ', utm_medium: 'cpc ' },
    expected: { utm_source: 'facebook', utm_medium: 'cpc' },
  },
  {
    name: 'Long values filtered out (>200 chars)',
    input: { utm_source: 'a'.repeat(201), utm_medium: 'valid' },
    expected: { utm_medium: 'valid' },
  },
  {
    name: 'All 5 UTM params',
    input: { 
      utm_source: 'google', 
      utm_medium: 'cpc', 
      utm_campaign: 'brand', 
      utm_term: 'dad circles',
      utm_content: 'ad_v2'
    },
    expected: { 
      utm_source: 'google', 
      utm_medium: 'cpc', 
      utm_campaign: 'brand', 
      utm_term: 'dad circles',
      utm_content: 'ad_v2'
    },
  },
];

console.log('🧪 UTM Extraction Tests\n');

let passed = 0;
let failed = 0;

for (const test of tests) {
  const result = extractUtmParams(test.input);
  const resultStr = JSON.stringify(result);
  const expectedStr = JSON.stringify(test.expected);
  
  if (resultStr === expectedStr) {
    console.log(`✅ ${test.name}`);
    passed++;
  } else {
    console.log(`❌ ${test.name}`);
    console.log(`   Expected: ${expectedStr}`);
    console.log(`   Got:      ${resultStr}`);
    failed++;
  }
}

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
