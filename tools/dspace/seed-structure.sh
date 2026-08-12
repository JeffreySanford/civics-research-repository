#!/bin/sh
set -eu

admin_email="${DSPACE_SEED_ADMIN_EMAIL:-admin@civics.local}"
admin_first="${DSPACE_SEED_ADMIN_FIRST:-Civics}"
admin_last="${DSPACE_SEED_ADMIN_LAST:-Administrator}"
admin_password="${DSPACE_SEED_ADMIN_PASSWORD:-civics-admin}"
community_name="${DSPACE_SEED_COMMUNITY:-Census Public Research Data}"
collection_name="${DSPACE_SEED_COLLECTION:-TIGER/Line Geospatial Files}"
item_mapfile="/dspace/assetstore/civics-tiger-line-seed.map"
export_file="/tmp/civics-current-structure.xml"
output_file="/tmp/civics-seed-structure-output.xml"

if ! /dspace/bin/dspace user -L | grep -qi "$admin_email"; then
  /dspace/bin/dspace create-administrator \
    -e "$admin_email" \
    -f "$admin_first" \
    -l "$admin_last" \
    -p "$admin_password" \
    -c en
fi

/dspace/bin/dspace structure-builder -e "$admin_email" -x -o "$export_file"

community_count="$(grep -c "<name>$community_name</name>" "$export_file" || true)"
collection_count="$(grep -c "<name>$collection_name</name>" "$export_file" || true)"

if [ "$community_count" -gt 1 ] || [ "$collection_count" -gt 1 ]; then
  echo "Duplicate DSpace seed structure detected. Reset the DSpace profile data or remove duplicate seed communities before reseeding." >&2
  echo "Community matches: $community_count; collection matches: $collection_count" >&2
  exit 1
fi

if [ "$community_count" -eq 1 ] && [ "$collection_count" -eq 1 ]; then
  echo "DSpace seed structure already exists: $community_name / $collection_name"
else
  /dspace/bin/dspace structure-builder \
    -e "$admin_email" \
    -f /seed/seed-structure.xml \
    -o "$output_file"

  cat "$output_file"
  /dspace/bin/dspace structure-builder -e "$admin_email" -x -o "$export_file"
fi

collection_handle="$(
  awk -v name="$collection_name" '
    /<collection identifier=/ {
      current = $0
      sub(/.*identifier="/, "", current)
      sub(/".*/, "", current)
    }
    index($0, "<name>" name "</name>") {
      print current
      exit
    }
  ' "$export_file"
)"

if [ -z "$collection_handle" ]; then
  echo "Unable to find DSpace collection handle for $collection_name" >&2
  exit 1
fi

if [ -s "$item_mapfile" ]; then
  echo "DSpace seed item already imported according to $item_mapfile"
  cat "$item_mapfile"
  exit 0
fi

/dspace/bin/dspace import \
  --add \
  --eperson "$admin_email" \
  --collection "$collection_handle" \
  --source /seed/saf \
  --mapfile "$item_mapfile" \
  --exclude-bitstreams

cat "$item_mapfile"
