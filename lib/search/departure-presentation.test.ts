import assert from 'node:assert/strict';
import test from 'node:test';
import { formatDateDdMmYyyy, formatDeparturePresentation } from './departure-presentation';

test('vaste zoekdatum → Vertrek op DD/MM/YYYY (ISO)', () => {
  const result = formatDeparturePresentation(
    { departureStart: '2026-08-28', departureEnd: '2026-08-28' },
    '2026-08-28',
  );
  assert.equal(result.mode, 'exact');
  assert.equal(result.phrase, 'Vertrek op 28/08/2026');
});

test('echte datumrange zonder offer → Vertrek tussen DD/MM/YYYY en DD/MM/YYYY', () => {
  const result = formatDeparturePresentation({
    departureStart: '2026-08-28',
    departureEnd: '2026-09-02',
  });
  assert.equal(result.mode, 'period');
  assert.equal(result.phrase, 'Vertrek tussen 28/08/2026 en 02/09/2026');
});

test('flexibel zoekvenster + concrete offerdatum → Vertrek op offerdatum', () => {
  const a = formatDeparturePresentation(
    { departureStart: '2026-08-26', departureEnd: '2026-09-02' },
    '2026-08-29',
  );
  assert.equal(a.mode, 'exact');
  assert.equal(a.phrase, 'Vertrek op 29/08/2026');
  assert.equal(a.phrase?.includes('tussen'), false);

  const b = formatDeparturePresentation(
    { departureStart: '2026-08-26', departureEnd: '2026-09-02' },
    '2026-09-01',
  );
  assert.equal(b.phrase, 'Vertrek op 01/09/2026');
});

test('flexibele zoekdatum zonder start/eind: offerdatum als Vertrek op, nooit tussen', () => {
  const sunweb = formatDeparturePresentation({}, '2026-08-28');
  assert.equal(sunweb.mode, 'exact');
  assert.equal(sunweb.phrase, 'Vertrek op 28/08/2026');
  assert.equal(sunweb.phrase?.includes('tussen'), false);

  const none = formatDeparturePresentation({}, undefined);
  assert.equal(none.mode, 'none');
  assert.equal(none.phrase, undefined);
});

test('ISO-input normalizes before display', () => {
  assert.equal(formatDateDdMmYyyy('2026-08-28'), '28/08/2026');
  assert.equal(
    formatDeparturePresentation({ departureStart: '2026-11-19', departureEnd: '2026-11-19' }).phrase,
    'Vertrek op 19/11/2026',
  );
});

test('Corendon-feeddatum DD/MM/YYYY is not parsed as US MM/DD', () => {
  assert.equal(formatDateDdMmYyyy('28/08/2026'), '28/08/2026');
  assert.equal(formatDateDdMmYyyy('04/10/2027'), '04/10/2027');
  const result = formatDeparturePresentation(
    { departureStart: '28/08/2026', departureEnd: '28/08/2026' },
    '17/11/2026',
  );
  assert.equal(result.phrase, 'Vertrek op 17/11/2026');
});

test('Sunweb/Eliza ISO offer date fallback when search has no window', () => {
  assert.equal(
    formatDeparturePresentation(undefined, '2026-11-19').phrase,
    'Vertrek op 19/11/2026',
  );
});

test('end missing is treated as an exact start date, not a range', () => {
  assert.equal(
    formatDeparturePresentation({ departureStart: '2026-08-28' }).phrase,
    'Vertrek op 28/08/2026',
  );
});

test('unknown catalog dates are not shown', () => {
  assert.equal(formatDateDdMmYyyy('6259883'), undefined);
  assert.equal(formatDeparturePresentation({}, '6259883').phrase, undefined);
});
