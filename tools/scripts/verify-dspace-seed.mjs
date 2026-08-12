const baseUrl = process.env.DSPACE_BASE_URL ?? 'http://localhost:8081/server';
const expectedName = '2025 TIGER/Line - Census Tracts - North Dakota';
const url = `${baseUrl}/api/discover/search/objects?query=${encodeURIComponent('TIGER/Line')}`;

const response = await fetch(url);

if (!response.ok) {
  throw new Error(
    `DSpace seed discovery check failed: ${response.status} ${response.statusText}`,
  );
}

const body = await response.json();
const objects =
  body?._embedded?.searchResult?._embedded?.objects?.map(
    (result) => result?._embedded?.indexableObject,
  ) ?? [];
const item = objects.find(
  (object) => object?.type === 'item' && object?.name === expectedName,
);

if (!item) {
  throw new Error(`DSpace seed item was not discoverable: ${expectedName}`);
}

console.log(`DSpace seed item is discoverable: ${item.name} (${item.handle})`);
