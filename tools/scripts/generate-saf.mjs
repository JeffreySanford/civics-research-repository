import {
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Generates the DSpace SAF packages the seed imports, from tools/dspace/catalog.json.
 *
 * Breadth is a property of the data table, not of the repository tree. Committing one directory
 * per item would mean hundreds of near-identical XML files whose only differences are a state name
 * and a FIPS code, and changing the program mix would mean regenerating all of them by hand. The
 * table is the committed source of truth; the packages below it are build output and git-ignored.
 *
 * Usage:
 *   node tools/scripts/generate-saf.mjs            regenerate every enabled program
 *   node tools/scripts/generate-saf.mjs --areas 5  first N areas only, for a faster loop
 */
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '..', '..');
const catalogPath = join(repoRoot, 'tools', 'dspace', 'catalog.json');
const outputRoot = join(repoRoot, 'tools', 'dspace', 'saf');

const args = process.argv.slice(2);
const areaLimitFlag = args.indexOf('--areas');
const areaLimit =
  areaLimitFlag === -1
    ? Number.POSITIVE_INFINITY
    : Number(args[areaLimitFlag + 1]);

const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
const areas = catalog.areas.slice(0, areaLimit);
/** Program/area combinations the publisher does not offer, reported at the end of a run. */
const skipped = [];
const programs = catalog.programs.filter((program) => program.enabled);

/** XML text escaping. Source URLs carry query strings, so ampersands are not hypothetical. */
function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function slug(value) {
  return value.toLowerCase().replaceAll(' ', '-');
}

function fill(template, tokens) {
  return String(template).replace(/\{(\w+)\}/g, (match, token) =>
    token in tokens ? String(tokens[token]) : match,
  );
}

function dcvalue(element, qualifier, value) {
  return `  <dcvalue element="${element}" qualifier="${qualifier}">${escapeXml(value)}</dcvalue>\n`;
}

function buildItem(program, area) {
  const tokens = {
    vintage: program.vintage,
    // Several Census file names carry a two-digit year (cbp23co.zip, est23all.txt, jan24pub.zip).
    vintageShort: String(program.vintage).slice(-2),
    area: area ? area.name : (program.geography ?? 'United States'),
    areaSlug: area ? slug(area.name) : 'united-states',
    fips: area ? area.fips : '',
    abbreviation: area ? area.abbreviation : '',
    abbreviationLower: area ? area.abbreviation.toLowerCase() : '',
  };

  const sourceUrl = fill(program.sourceUrlTemplate, tokens);
  const documentationUrl = fill(program.documentationUrl, tokens);
  const withUrls = { ...tokens, sourceUrl, documentationUrl };

  return {
    id: fill(program.idTemplate, withUrls),
    title: fill(program.titleTemplate, withUrls),
    abstract: fill(program.abstractTemplate, withUrls),
    issued: fill(program.issuedTemplate, withUrls),
    citation: fill(program.citationTemplate, withUrls),
    geography: tokens.area,
    geographyLevel: program.geographyLevel,
    programId: program.id,
    vintage: String(program.vintage),
    publisher: catalog.publisherDefaults[program.publisher],
    subjects: program.subjects,
    sourceUrl,
    documentationUrl,
    // Everything generated from a program template is a dataset, published openly by a federal
    // agency. The license is stated rather than assumed absent: a work of the U.S. Government is
    // public domain, and saying so is the difference between reusable and merely downloadable.
    resourceType: 'DATASET',
    access: 'PUBLIC',
    license: catalog.defaultLicense,
    authors: [],
    relations: [],
    files: program.files.map((file) => ({
      ...file,
      url: fill(file.url, withUrls),
    })),
  };
}

/**
 * Builds a research object authored directly in the catalog rather than from a program template.
 *
 * Publications, methodology reports and projects are singletons: there is one spatial-mismatch
 * paper, not one per state. Forcing them through the program templates would mean inventing
 * `{area}` tokens for objects that have no area, so they are authored literally and validated here
 * instead. Everything downstream treats them identically to a generated dataset.
 */
function buildResearchObject(entry) {
  for (const required of ['id', 'resourceType', 'title', 'abstract', 'sourceUrl']) {
    if (!entry[required]) {
      throw new Error(`Research object ${entry.id ?? '(no id)'} is missing ${required}.`);
    }
  }

  return {
    id: entry.id,
    title: entry.title,
    abstract: entry.abstract,
    issued: entry.issued,
    citation: entry.citation,
    geography: entry.geography ?? 'United States',
    geographyLevel: entry.geographyLevel ?? 'National',
    programId: entry.program,
    vintage: String(entry.vintage),
    publisher: catalog.publisherDefaults[entry.publisher],
    subjects: entry.subjects ?? [],
    sourceUrl: entry.sourceUrl,
    documentationUrl: entry.documentationUrl,
    resourceType: entry.resourceType,
    access: entry.access ?? 'PUBLIC',
    license: entry.license ?? catalog.defaultLicense,
    accessNote: entry.accessNote,
    doi: entry.doi,
    authors: entry.authors ?? [],
    relations: entry.relations ?? [],
    files: entry.files ?? [],
  };
}

/**
 * Directories are named by source identifier, not by position.
 *
 * The seed's mapfile records "<directory> <handle>", and `dspace import --resume` skips directories
 * it has already imported. Positional names (item_000) would shift whenever the program mix or area
 * list changed, so a regeneration would silently re-import existing items under new handles and
 * leave two repository items claiming the same source identifier.
 */
/**
 * SAF trees are grouped by target collection, because `dspace import` takes one collection per run.
 *
 * The type is already on the item as crr.resource.type; this decides where the item lives in
 * DSpace, which its own interfaces and OAI-PMH sets organise by.
 */
const COLLECTION_DIRECTORY = {
  DATASET: 'datasets',
  PUBLICATION: 'publications',
  METHODOLOGY: 'methodology',
  CODE: 'methodology',
  SUPPORTING_MATERIAL: 'methodology',
  PROJECT: 'projects',
};

function writeItem(item) {
  const collectionDirectory = COLLECTION_DIRECTORY[item.resourceType];
  if (!collectionDirectory) {
    throw new Error(`${item.id} has no collection for type ${item.resourceType}.`);
  }
  const directory = join(outputRoot, collectionDirectory, item.id);
  mkdirSync(directory, { recursive: true });

  let dublinCore = '<?xml version="1.0" encoding="UTF-8"?>\n';
  dublinCore +=
    '<!-- Generated by tools/scripts/generate-saf.mjs from tools/dspace/catalog.json. Do not edit. -->\n';
  dublinCore += '<dublin_core schema="dc">\n';
  dublinCore += dcvalue('title', 'none', item.title);
  // The agency is the author only when no person is. A working paper whose first listed
  // author is "U.S. Census Bureau" misattributes work that three named researchers did.
  if ((item.authors ?? []).length === 0) {
    dublinCore += dcvalue('contributor', 'author', item.publisher);
  }
  dublinCore += dcvalue('publisher', 'none', item.publisher);
  dublinCore += dcvalue('description', 'abstract', item.abstract);
  dublinCore += dcvalue('date', 'issued', item.issued);
  dublinCore += dcvalue('identifier', 'other', item.id);
  dublinCore += dcvalue('identifier', 'uri', item.sourceUrl);
  dublinCore += dcvalue('relation', 'uri', item.documentationUrl);
  dublinCore += dcvalue('identifier', 'citation', item.citation);
  for (const subject of item.subjects) {
    dublinCore += dcvalue('subject', 'none', subject);
  }
  // Authors go in dc as well as crr: dc.contributor.author is the field every repository harvester
  // and citation exporter already knows to read, and a publication whose authors live only in a
  // project-specific schema is not really deposited.
  for (const researcher of item.authors ?? []) {
    dublinCore += dcvalue('contributor', 'author', researcher.name);
  }
  dublinCore += dcvalue('coverage', 'spatial', item.geography);
  dublinCore += '</dublin_core>\n';
  writeFileSync(join(directory, 'dublin_core.xml'), dublinCore, 'utf8');

  // Non-dc schemas live in their own file; DSpace ignores a per-value schema attribute.
  let crr = '<?xml version="1.0" encoding="UTF-8"?>\n';
  crr +=
    '<!-- Generated by tools/scripts/generate-saf.mjs. Fields registered in tools/dspace/crr-types.xml. -->\n';
  crr += '<dublin_core schema="crr">\n';
  crr += dcvalue('identifier', 'source', item.id);
  crr += dcvalue('program', 'none', item.programId);
  crr += dcvalue('geography', 'level', item.geographyLevel);
  crr += dcvalue('vintage', 'none', item.vintage);
  crr += dcvalue('source', 'url', item.sourceUrl);
  crr += dcvalue('documentation', 'url', item.documentationUrl);
  crr += dcvalue('resource', 'type', item.resourceType);
  crr += dcvalue('rights', 'access', item.access);
  if (item.license) {
    crr += dcvalue('rights', 'license', item.license);
  }
  // Only where access is not public: an access note on an open object is noise, and its absence
  // is how a reader can tell the two apart at a glance.
  if (item.accessNote) {
    crr += dcvalue('rights', 'accessnote', item.accessNote);
  }
  // Omitted rather than emitted blank. A DOI field present but empty reads as "no DOI exists",
  // which is a claim; absence reads as "not recorded", which is the truth.
  if (item.doi) {
    crr += dcvalue('identifier', 'doi', item.doi);
  }
  for (const researcher of item.authors ?? []) {
    crr += dcvalue('contributor', 'researcher', JSON.stringify(researcher));
  }
  for (const relation of item.relations ?? []) {
    crr += dcvalue('relation', 'edge', JSON.stringify(relation));
  }
  for (const file of item.files) {
    // Matches DspaceFileManifest.encode on the Java side, so a seeded item and a synchronized one
    // describe their files identically and sync:diff can reach SKIP_ITEM without a first apply.
    crr += dcvalue(
      'file',
      'manifest',
      JSON.stringify({
        id: file.id,
        label: file.label,
        bundle: 'ORIGINAL',
        format: file.format,
        url: file.url,
      }),
    );
  }
  crr += '</dublin_core>\n';
  writeFileSync(join(directory, 'metadata_crr.xml'), crr, 'utf8');

  // Empty, not a blank line. DSpace reads `contents` line by line, and a leading newline is
  // a malformed first entry: the item imports none of the bitstreams listed after it.
  writeFileSync(join(directory, 'contents'), '', 'utf8');
}

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

const items = [];
for (const program of programs) {
  if (program.scope === 'national') {
    items.push(buildItem(program, null));
    continue;
  }

  for (const area of areas) {
    // A program can be genuinely unpublished for an area. Seeding it anyway would give the
    // repository a research object whose source URL 404s, which reads as provenance and is not.
    const unavailableReason = program.unavailableAreas?.[area.name];
    if (unavailableReason) {
      skipped.push(`${program.id} / ${area.name}: ${unavailableReason}`);
      continue;
    }

    items.push(buildItem(program, area));
  }
}

for (const entry of catalog.researchObjects ?? []) {
  if (entry.enabled === false) {
    continue;
  }
  items.push(buildResearchObject(entry));
}

// Stable ordering keeps regeneration diff-free.
items.sort((left, right) => left.id.localeCompare(right.id));

const seen = new Set();
for (const item of items) {
  if (seen.has(item.id)) {
    throw new Error(
      `Duplicate source identifier in catalog output: ${item.id}`,
    );
  }
  seen.add(item.id);
  writeItem(item);
}

// A relation naming an object that does not exist is worse than no relation: it renders as a
// dangling link and quietly tells the reader the repository does not know its own contents.
for (const item of items) {
  for (const relation of item.relations ?? []) {
    if (!seen.has(relation.target)) {
      throw new Error(
        `${item.id} declares ${relation.verb} -> ${relation.target}, which is not a catalog object.`,
      );
    }
  }
}

writeFixtureCatalog(items);

const byType = new Map();
for (const item of items) {
  byType.set(item.resourceType, (byType.get(item.resourceType) ?? 0) + 1);
}

const byProgram = new Map();
for (const item of items) {
  byProgram.set(item.programId, (byProgram.get(item.programId) ?? 0) + 1);
}

const catalogStat = statSync(catalogPath);
writeFileSync(
  join(outputRoot, '.generated-from-catalog'),
  `${catalogStat.mtimeMs}:${catalogStat.size}\n`,
);

console.log(`Generated ${items.length} SAF packages into tools/dspace/saf`);
for (const [programId, count] of [...byProgram].sort()) {
  console.log(`  ${programId.padEnd(12)} ${count}`);
}
console.log('');
for (const [resourceType, count] of [...byType].sort()) {
  console.log(`  ${resourceType.padEnd(14)} ${count}`);
}
if (Number.isFinite(areaLimit)) {
  console.log(`  (limited to the first ${areas.length} areas)`);
}

if (skipped.length > 0) {
  console.log(`
Skipped ${skipped.length} program/area combination(s) the publisher does not offer:`);
  for (const reason of skipped) {
    console.log(`  ${reason}`);
  }
}

/**
 * Writes the resolved catalog the API serves when DSpace is unavailable.
 *
 * The fallback used to be a second catalog, hand-written in Java, and it drifted: it listed LODES
 * for three areas the publisher does not cover, linked program pages rather than the verified
 * file-level URLs, and never gained the eight programs added later. It was labelled FIXTURE, so it
 * was not pretending to be repository content, but it still named a source URL for files that do
 * not exist.
 *
 * Emitting it from the same items as the SAF packages makes that class of drift impossible: there
 * is one catalog, resolved once, and both outputs come from it. Committed rather than git-ignored,
 * because it is compiled into the API jar; `pnpm run fixture:check` fails if it is stale.
 */
function writeFixtureCatalog(catalogItems) {
  const fixture = {
    $comment:
      'Generated by tools/scripts/generate-saf.mjs from tools/dspace/catalog.json. Do not edit. Run: pnpm run dspace:saf:generate',
    generatedFrom: 'tools/dspace/catalog.json',
    items: catalogItems.map((item) => ({
      id: item.id,
      title: item.title,
      program: item.programId,
      publisher: item.publisher,
      summary: item.abstract,
      geography: item.geography,
      geographyLevel: item.geographyLevel,
      vintageYear: Number(item.vintage),
      releasedOn: item.issued,
      citation: item.citation,
      sourceUrl: item.sourceUrl,
      documentationUrl: item.documentationUrl,
      contentType: item.resourceType,
      accessLevel: item.access,
      license: item.license,
      accessNote: item.accessNote,
      doi: item.doi,
      authors: item.authors,
      relations: item.relations,
      files: item.files.map((file) => ({
        id: file.id,
        label: file.label,
        format: file.format,
        url: file.url,
      })),
    })),
  };

  const fixturePath = join(
    repoRoot,
    'apps',
    'repository-api',
    'src',
    'main',
    'resources',
    'discovery-fixture-catalog.json',
  );
  writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`);
}
