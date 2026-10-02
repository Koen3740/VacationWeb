/**
 * t334u (owner correction to t333u): label rule = the name the user searches on is ALWAYS first,
 * context ALWAYS last and only where needed. NOT "place always before region", NOT "Regio - Plaats".
 * GOOD: "Agia Paraskevi \u2014 Samos", "Alanya \u2014 stad", "Kalamaki \u2014 Kreta", "Agia Marina" (one entry).
 * NOT: "Chania - Agia Marina", "Samos - Agia Paraskevi", "Kreta - Kalamaki".
 * Runs on the REAL generated directory (data/destination-directory.json).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  MAX_DESTINATION_SUGGESTIONS,
  buildDestinationSearchIndex,
  destinationDisplayLabel,
  formatPlaceSelectionLabel,
  searchDestinations,
  type DestinationSuggestion,
} from '@/components/search/destination-popup/destination-search';

const EM = '\u2014';
const INDEX = buildDestinationSearchIndex({});
const labels = (term: string, limit?: number) => searchDestinations(INDEX, term, limit).map((s) => s.label);

describe('t334u label rule on the real directory', () => {
  it('no label anywhere starts with a provider-style "Regio - Plaats" (no ASCII " - " label at all)', () => {
    const dashed = INDEX.filter((s) => / - /.test(s.label)).map((s) => s.label);
    assert.deepEqual(dashed, []);
  });

  it('every disambiguated label is "<name> \u2014 <context>": the part before the dash IS the searched name', () => {
    const withContext = INDEX.filter((s) => s.label.includes(` ${EM} `));
    assert.ok(withContext.length > 40);
    for (const suggestion of withContext) {
      const [name, context] = suggestion.label.split(` ${EM} `);
      assert.ok(context && context.length > 0, suggestion.label);
      assert.equal(suggestion.label.split(` ${EM} `).length, 2, suggestion.label);
      // name-first: the matchable primary name is exactly the text before the dash
      assert.ok(suggestion.normalized.length > 0);
      assert.ok(
        name!.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim() ===
          suggestion.normalized.replace(/[^a-z0-9]+/g, ' ').trim(),
        `${suggestion.label} vs ${suggestion.normalized}`,
      );
    }
  });

  it('the five former raw composites are shown name-first (URL values untouched)', () => {
    const wanted: Array<[string, string, string]> = [
      ['Portugal', 'Sao Miquel - Caloura', `Caloura ${EM} Sao Miguel`],
      ['Spanje', 'Marbella - San Pedro', `San Pedro ${EM} Marbella`],
      ['Turkije', 'Bodrum - Guvercinlik', `Guvercinlik ${EM} Bodrum`],
      ['Griekenland', 'Ouranoupoli - Athos', `Ouranoupoli ${EM} Athos`],
    ];
    for (const [country, raw, label] of wanted) {
      const hit = INDEX.find((s) => s.country === country && s.value === raw);
      assert.ok(hit, raw);
      assert.equal(hit!.label, label);
      assert.equal(hit!.value, raw, 'URL value stays the catalog value');
    }
    const pieria = INDEX.find((s) => s.kind === 'region' && s.value === 'Pieria - Olympus Riviera');
    assert.equal(pieria?.label, `Olympus Riviera ${EM} Pieria`);
    assert.equal(pieria?.value, 'Pieria - Olympus Riviera');
  });
});

describe('t334u required test destinations', () => {
  it('Agia Marina: ONE entry, plain label, never "Chania - Agia Marina", Chania never before it', () => {
    assert.deepEqual(labels('agia marina'), ['Agia Marina']);
    assert.equal(INDEX.filter((s) => s.normalized === 'agia marina').length, 1);
    assert.equal(INDEX.some((s) => /chania\s*-\s*agia marina/i.test(s.label)), false);
    assert.equal(INDEX.some((s) => /agia marina/i.test(s.label) && s.label !== 'Agia Marina'), false);
    // searching "agia" never lists Chania; searching "chania": the place Chania stays before Agia Marina
    assert.equal(labels('agia').includes('Chania'), false);
    const chania = labels('chania', 50);
    assert.ok(chania.indexOf('Chania') >= 0 && chania.indexOf('Agia Marina') > chania.indexOf('Chania'));
  });

  it('Agia Paraskevi: both disambiguations visible together, name first, em dash, Samos/Santorini last', () => {
    assert.deepEqual(labels('agia paraskevi'), [`Agia Paraskevi ${EM} Samos`, `Agia Paraskevi ${EM} Santorini`]);
    assert.equal(INDEX.some((s) => /^(Samos|Santorini)\b.*Agia Paraskevi/i.test(s.label)), false);
    assert.equal(labels('agia paraskevi').some((l) => l.includes(' - ')), false);
  });

  it('Agia Pelagia and Agia Pelagia Spili: all variants of the specific term are visible', () => {
    assert.deepEqual(labels('agia pelagia'), ['Agia Pelagia', 'Agia Pelagia Spili']);
    assert.deepEqual(labels('agia pelagia spili'), ['Agia Pelagia Spili']);
  });

  it('Alanya / Side / Hurghada / Marmaris: city twin before region twin, both visible, name first', () => {
    assert.deepEqual(labels('alanya').slice(0, 2), [`Alanya ${EM} stad`, `Alanya ${EM} regio`]);
    for (const name of ['Side', 'Hurghada', 'Marmaris', 'Kemer']) {
      assert.deepEqual(labels(name.toLowerCase()).slice(0, 2), [`${name} ${EM} stad`, `${name} ${EM} regio`]);
    }
  });

  it('Kalamaki: all four homonyms together, name first, context last (no "Kreta - Kalamaki")', () => {
    assert.deepEqual(labels('kalamaki'), [
      `Kalamaki ${EM} Chania`,
      `Kalamaki ${EM} Kreta`,
      `Kalamaki ${EM} Peloponnesos`,
      `Kalamaki ${EM} Zakynthos`,
    ]);
  });

  it('Tossa de Mar and Cala d\u2019Or: single, plain', () => {
    assert.deepEqual(labels('tossa'), ['Tossa de Mar']);
    assert.deepEqual(labels("cala d'or"), ["Cala d'Or"]);
  });
});

describe('t334u stored selections use the same label (chip / sidebar / Results summary)', () => {
  it('destinationDisplayLabel / formatPlaceSelectionLabel: name first, context last, URL values unchanged', () => {
    assert.equal(destinationDisplayLabel('Griekenland', { city: 'Chania - Kalamaki' }), `Kalamaki ${EM} Chania`);
    assert.equal(destinationDisplayLabel('Spanje', { city: 'Marbella - San Pedro' }), `San Pedro ${EM} Marbella`);
    assert.equal(
      destinationDisplayLabel('Griekenland', { city: 'Agia Paraskevi', region: 'Samos' }),
      `Agia Paraskevi ${EM} Samos`,
    );
    assert.equal(destinationDisplayLabel('Turkije', { region: 'Alanya' }), `Alanya ${EM} regio`);
    assert.equal(destinationDisplayLabel('Turkije', { city: 'Alanya' }), `Alanya ${EM} stad`);
    assert.equal(destinationDisplayLabel('Griekenland', { city: 'Agia Marina' }), 'Agia Marina', 'plain name, no context');
    assert.equal(
      formatPlaceSelectionLabel({ country: 'Griekenland', city: 'Chania - Kalamaki' }),
      `Kalamaki ${EM} Chania`,
    );
    assert.equal(formatPlaceSelectionLabel({ country: 'Griekenland', city: 'Agia Marina' }), 'Agia Marina');
  });

  it('source guard: sidebar selects and Results summary go through the display label (option values stay raw)', () => {
    const sidebar = readFileSync('components/results/filter-sidebar.tsx', 'utf8');
    assert.match(sidebar, /<option key=\{city\} value=\{city\}>\s*\{cityOptionLabel\(city\)\}/);
    assert.match(sidebar, /<option key=\{region\} value=\{region\}>\s*\{regionOptionLabel\(region\)\}/);
    const page = readFileSync('app/results/page.tsx', 'utf8');
    assert.match(page, /destinationDisplayLabel\(summaryCountry, \{ city: params\.city \}\)/);
    assert.doesNotMatch(page, /decodePlaceName\(params\.city\)/);
  });
});

describe('t334u autocomplete: the limit is a UI limit, siblings of one name are never half visible', () => {
  const groups = new Map<string, DestinationSuggestion[]>();
  for (const s of INDEX) groups.set(s.normalized, [...(groups.get(s.normalized) ?? []), s]);
  const homonyms = [...groups.values()].filter((g) => g.length >= 2);

  it('real directory has homonym groups and none is larger than the UI limit', () => {
    assert.ok(homonyms.length >= 25);
    assert.ok(Math.max(...homonyms.map((g) => g.length)) <= MAX_DESTINATION_SUGGESTIONS);
  });

  it('typing the primary name shows EVERY variant of that name (all homonym groups)', () => {
    for (const group of homonyms) {
      const top = searchDestinations(INDEX, group[0]!.normalized);
      for (const member of group) {
        assert.ok(top.some((t) => t.id === member.id), `${group[0]!.normalized}: ${member.label} missing`);
      }
    }
  });

  it('no prefix of a homonym name cuts a matching variant off at the limit', () => {
    for (const group of homonyms) {
      const name = group[0]!.normalized;
      for (let n = 2; n <= name.length; n += 1) {
        const term = name.slice(0, n).trim();
        if (!term) continue;
        const all = searchDestinations(INDEX, term, 10_000);
        const top = searchDestinations(INDEX, term);
        const matchingGroup = all.filter((s) => s.normalized === name);
        const shown = matchingGroup.filter((s) => top.some((t) => t.id === s.id));
        assert.ok(
          shown.length === 0 || shown.length === matchingGroup.length,
          `${term}: ${shown.length}/${matchingGroup.length} of "${name}" visible`,
        );
      }
    }
  });

  it('a group straddling the limit is completed; match quality stays primary (synthetic)', () => {
    const make = (id: string, name: string, suffix?: string): DestinationSuggestion => ({
      id,
      kind: 'city',
      label: suffix ? `${name} ${EM} ${suffix}` : name,
      value: name,
      country: 'Testland',
      normalized: name.toLowerCase(),
      normalizedFull: `${name} ${suffix ?? ''}`.trim().toLowerCase(),
    });
    const index = [
      make('1', 'Aaa One'),
      make('2', 'Aaa Two'),
      make('3', 'Aaa Three'),
      make('4', 'Aaa Four'),
      make('5', 'Aaa Five'),
      make('6', 'Aaa Six'),
      make('7', 'Aaa Seven'),
      make('8', 'Aab Twin', 'Noord'),
      make('9', 'Aab Twin', 'Zuid'),
      make('10', 'Aac Later'),
    ];
    const top = searchDestinations(index, 'aa', 8);
    assert.equal(top.length, 9, 'limit 8 would cut "Aab Twin" in half: both variants are shown');
    assert.deepEqual(top.slice(-2).map((s) => s.label), [`Aab Twin ${EM} Noord`, `Aab Twin ${EM} Zuid`]);
    // exact match still beats a prefix match whatever the group order
    const exact = searchDestinations([make('a', 'Zzz'), make('b', 'Aaa Zzz Prefix'), make('c', 'Zzzz')], 'zzz');
    assert.equal(exact[0]!.label, 'Zzz');
  });

  it('existing good ranking is kept: exact region above a prefix place, country first (M1 untouched)', () => {
    assert.equal(labels('kreta')[0], 'Kreta');
    assert.equal(labels('mallorca')[0], 'Mallorca');
    assert.equal(labels('span')[0], 'Spanje');
    assert.equal(labels('port')[0], 'Portugal');
  });
});
