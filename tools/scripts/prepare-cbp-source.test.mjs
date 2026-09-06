import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildMetadata,
  parseCsv,
  prepareCbpDataset,
  prepareCbpRows,
  serializeCbpRows,
} from './prepare-cbp-source.mjs';

const HEADER = 'fipstate,fipscty,naics,emp_nf,emp,qp1_nf,qp1,ap_nf,ap,est,n1_4';

function source(...rows) {
  return `${HEADER}\n${rows.join('\n')}\n`;
}

test('parseCsv handles quoted commas and escaped quotes', () => {
  assert.deepEqual(parseCsv('A,B\n"one,two","say ""hi"""\n'), [
    ['A', 'B'],
    ['one,two', 'say "hi"'],
  ]);
});

test('prepareCbpRows retains totals and two-digit source rows only', () => {
  const rows = prepareCbpRows(
    source(
      '01,001,------,G,100,H,200,J,800,10,4',
      '01,001,11----,H,10,G,20,G,80,3,1',
      '01,001,113///,H,8,G,18,G,70,3,1',
      '01,003,31----,,0,,0,,0,0,0',
    ),
  );

  assert.deepEqual(
    rows.map(({ geoid, industryCode, sourceNaics }) => ({
      geoid,
      industryCode,
      sourceNaics,
    })),
    [
      { geoid: '01001', industryCode: 'TOTAL', sourceNaics: '------' },
      { geoid: '01001', industryCode: '11', sourceNaics: '11----' },
      { geoid: '01003', industryCode: '31', sourceNaics: '31----' },
    ],
  );
});

test('prepareCbpRows preserves published numeric zero rather than calling it unavailable', () => {
  const [row] = prepareCbpRows(source('38,093,------,G,0,G,0,G,0,0,0'));

  assert.equal(row.establishments, 0);
  assert.equal(row.employment, 0);
  assert.equal(row.firstQuarterPayrollThousands, 0);
  assert.equal(row.annualPayrollThousands, 0);
});

test('prepareCbpRows does not manufacture a missing county-industry row', () => {
  const rows = prepareCbpRows(
    source(
      '38,001,------,G,100,G,200,G,800,10,4',
      '38,001,11----,G,10,G,20,G,80,3,1',
      '38,003,------,G,120,G,240,G,960,12,5',
    ),
  );

  assert.equal(
    rows.some((row) => row.geoid === '38003' && row.industryCode === '11'),
    false,
  );
});

test('prepareCbpDataset excludes XX999 aggregate rows from county map data', () => {
  const dataset = prepareCbpDataset(
    source(
      '01,001,------,G,100,G,200,G,800,10,4',
      '01,999,------,G,70000,H,900000,H,4000000,700,10',
      '01,999,11----,H,1000,J,12000,J,50000,20,3',
      '01,999,113///,H,500,J,6000,J,25000,10,2',
    ),
  );

  assert.deepEqual(
    dataset.rows.map((row) => row.geoid),
    ['01001'],
  );
  assert.equal(dataset.excludedStatewideRows, 2);
  assert.equal(
    dataset.rows.some((row) => row.geoid.endsWith('999')),
    false,
  );
});

test('prepareCbpRows rejects duplicate retained county-industry rows', () => {
  assert.throws(
    () =>
      prepareCbpRows(
        source(
          '01,001,11----,G,10,G,20,G,80,3,1',
          '01,001,11----,H,11,H,21,H,81,4,2',
        ),
      ),
    /duplicate retained county\/industry row 01001:11/,
  );
});

test('prepareCbpRows rejects an unknown noise flag', () => {
  assert.throws(
    () => prepareCbpRows(source('01,001,------,X,10,G,20,G,80,3,1')),
    /invalid EMP_NF value "X"/,
  );
});

test('serializeCbpRows and metadata are deterministic', () => {
  const sourceText = source(
    '38,001,------,G,100,H,200,J,800,10,4',
    '38,001,11----,H,10,G,20,G,80,3,1',
    '38,999,------,H,999,H,1999,H,7999,99,9',
  );
  const dataset = prepareCbpDataset(sourceText);
  const normalizedText = serializeCbpRows(dataset.rows);
  const metadata = buildMetadata({
    sourceBytes: Buffer.from(sourceText),
    normalizedText,
    retainedRows: dataset.rows,
    excludedStatewideRows: dataset.excludedStatewideRows,
    capturedAt: '2026-09-06',
    sourceFileName: 'cbp23co.txt',
  });

  assert.match(normalizedText, /^GEOID,INDUSTRY_CODE,SOURCE_NAICS,/);
  assert.doesNotMatch(normalizedText, /38999/);
  assert.equal(metadata.referenceYear, 2023);
  assert.equal(metadata.retainedRows, 2);
  assert.equal(metadata.retainedCounties, 1);
  assert.equal(metadata.excludedStatewideRows, 1);
  assert.equal(metadata.countyEligibilityRule, 'FIPSCTY != 999');
  assert.deepEqual(metadata.supportedIndustryCodes, ['TOTAL', '11']);
  assert.match(metadata.sourceFileSha256, /^[a-f0-9]{64}$/);
  assert.match(metadata.normalizedSha256, /^[a-f0-9]{64}$/);
  assert.match(metadata.missingRowSemantics, /must not be interpreted as zero/);
});
