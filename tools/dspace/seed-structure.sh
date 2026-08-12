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

/dspace/bin/dspace registry-loader --metadata /seed/crr-types.xml

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

saf_item_count="$(find /seed/saf -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
resume_flag=""

# The mapfile lives in the assetstore volume, which outlives the database volume. Trusting it
# blindly means that if the database is ever reset, the seed skips the import forever and leaves an
# empty repository. Verify the referenced items still exist before believing the mapfile.
# -f rather than -s: a failed import leaves an empty mapfile behind, and `dspace import` refuses to
# run when the file exists at all, so an empty one wedges every later attempt.
if [ -f "$item_mapfile" ]; then
  mapped_count="$(awk 'NF' "$item_mapfile" 2>/dev/null | wc -l | tr -d ' ')"
  mapped_handle="$(awk 'NF {print $2; exit}' "$item_mapfile" 2>/dev/null || true)"

  if [ -n "$mapped_handle" ] &&
    /dspace/bin/dspace metadata-export -i "$mapped_handle" -f /tmp/civics-seed-item-check.csv >/dev/null 2>&1; then

    if [ "$mapped_count" -ge "$saf_item_count" ]; then
      echo "DSpace seed items already imported: $mapped_count of $saf_item_count"
      cat "$item_mapfile"
      exit 0
    fi

    # Some SAF packages are new since the last run. --resume skips the ones already in the mapfile
    # and imports only the remainder, so adding a seed item does not require a repository reset.
    echo "Seed mapfile holds $mapped_count of $saf_item_count items; importing the remainder."
    resume_flag="--resume"
  else
    echo "Seed mapfile references ${mapped_handle:-an unknown handle}, which no longer exists in DSpace."
    echo "Removing the stale mapfile and re-importing every seed item."
    rm -f "$item_mapfile"
  fi
fi

# shellcheck disable=SC2086
/dspace/bin/dspace import \
  --add \
  $resume_flag \
  --eperson "$admin_email" \
  --collection "$collection_handle" \
  --source /seed/saf \
  --mapfile "$item_mapfile" \
  --exclude-bitstreams

cat "$item_mapfile"
