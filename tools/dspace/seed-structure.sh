#!/bin/sh
set -eu

admin_email="${DSPACE_SEED_ADMIN_EMAIL:-admin@civics.local}"
admin_first="${DSPACE_SEED_ADMIN_FIRST:-Civics}"
admin_last="${DSPACE_SEED_ADMIN_LAST:-Administrator}"
admin_password="${DSPACE_SEED_ADMIN_PASSWORD:-civics-admin}"
community_name="${DSPACE_SEED_COMMUNITY:-Census Public Research Data}"
collection_name="${DSPACE_SEED_COLLECTION:-TIGER/Line Geospatial Files}"

# SAF directory -> collection name. The generator groups packages by target collection because
# `dspace import` takes exactly one collection per run, so the seed walks the groups.
seed_groups="datasets:TIGER/Line Geospatial Files
publications:Research Publications
methodology:Methodology and Code
projects:Research Projects"
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

# Resolves one collection handle by name from the exported structure.
find_collection_handle() {
  awk -v name="$1" '
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
}

# Imports one SAF group into one collection, resuming where a previous run left off.
#
# Each group keeps its own mapfile, because `dspace import --resume` skips directories already
# listed in the mapfile it is given. A single shared mapfile would make the second group's import
# believe the first group's items were its own and skip everything.
import_group() {
  group_dir="$1"
  group_collection="$2"
  source_dir="/seed/saf/$group_dir"
  mapfile_path="/dspace/assetstore/civics-seed-$group_dir.map"

  if [ ! -d "$source_dir" ]; then
    echo "No SAF packages for $group_dir; skipping."
    return 0
  fi

  handle="$(find_collection_handle "$group_collection")"
  if [ -z "$handle" ]; then
    echo "Unable to find DSpace collection handle for $group_collection" >&2
    exit 1
  fi

  item_count="$(find "$source_dir" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
  resume_flag=""

  # The mapfile lives in the assetstore volume, which outlives the database volume. Trusting it
  # blindly means that if the database is ever reset, the seed skips the import forever and leaves
  # an empty repository. Verify the referenced items still exist before believing the mapfile.
  # -f rather than -s: a failed import leaves an empty mapfile behind, and `dspace import` refuses
  # to run when the file exists at all, so an empty one wedges every later attempt.
  if [ -f "$mapfile_path" ]; then
    mapped_count="$(awk 'NF' "$mapfile_path" 2>/dev/null | wc -l | tr -d ' ')"
    mapped_handle="$(awk 'NF {print $2; exit}' "$mapfile_path" 2>/dev/null || true)"

    if [ -n "$mapped_handle" ] &&
      /dspace/bin/dspace metadata-export -i "$mapped_handle" -f /tmp/civics-seed-item-check.csv >/dev/null 2>&1; then

      if [ "$mapped_count" -ge "$item_count" ]; then
        echo "$group_dir already imported: $mapped_count of $item_count"
        return 0
      fi

      echo "$group_dir holds $mapped_count of $item_count items; importing the remainder."
      resume_flag="--resume"
    else
      echo "$group_dir mapfile references ${mapped_handle:-an unknown handle}, which no longer exists."
      rm -f "$mapfile_path"
    fi
  fi

  echo "Importing $item_count item(s) from $group_dir into $group_collection ($handle)."

  # Bitstreams are imported. The flag that skipped them was correct while every `contents` file was
  # empty, but tools/scripts/mirror-source-files.mjs now stages real source files beside the
  # metadata, and --exclude-bitstreams would silently drop every one of them: items would import
  # cleanly, the handles would look right, and the assetstore would stay at a few kilobytes.
  # shellcheck disable=SC2086
  /dspace/bin/dspace import \
    --add \
    $resume_flag \
    --eperson "$admin_email" \
    --collection "$handle" \
    --source "$source_dir" \
    --mapfile "$mapfile_path"

  cat "$mapfile_path"
}

echo "$seed_groups" | while IFS=: read -r group_dir group_collection; do
  [ -n "$group_dir" ] || continue
  import_group "$group_dir" "$group_collection"
done
