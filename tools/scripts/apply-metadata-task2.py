from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one anchor, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


catalog = Path("tools/dspace/catalog.json")
catalog_anchor = (
    '      "accessNote": "Access requires an approved research proposal and Special Sworn Status through a Federal Statistical Research Data Center. No confidential records are held by this repository.",\n'
    '      "relations": [\n'
)
catalog_replacement = (
    '      "accessNote": "Access requires an approved research proposal and Special Sworn Status through a Federal Statistical Research Data Center. No confidential records are held by this repository.",\n'
    '      "accessGuidance": {\n'
    '        "mechanism": "FSRDC",\n'
    '        "accessUrl": "https://www.census.gov/about/adrm/fsrdc.html",\n'
    '        "instructions": "Access requires an approved research proposal and Special Sworn Status through a Federal Statistical Research Data Center.",\n'
    '        "restrictionBasis": "Title 13, U.S. Code"\n'
    '      },\n'
    '      "relations": [\n'
)
replace_once(catalog, catalog_anchor, catalog_replacement)

generator = Path("tools/scripts/generate-saf.mjs")
replace_once(
    generator,
    "    accessNote: entry.accessNote,\n    doi: entry.doi,\n",
    "    accessNote: entry.accessNote,\n"
    "    accessGuidance: entry.accessGuidance ?? null,\n"
    "    doi: entry.doi,\n",
)
replace_once(
    generator,
    "  if (item.accessNote) {\n"
    "    crr += dcvalue('rights', 'accessnote', item.accessNote);\n"
    "  }\n"
    '  // Omitted rather than emitted blank. A DOI field present but empty reads as "no DOI exists",\n',
    "  if (item.accessNote) {\n"
    "    crr += dcvalue('rights', 'accessnote', item.accessNote);\n"
    "  }\n"
    "  if (item.accessGuidance?.mechanism) {\n"
    "    crr += dcvalue('access', 'mechanism', item.accessGuidance.mechanism);\n"
    "  }\n"
    "  if (item.accessGuidance?.accessUrl) {\n"
    "    crr += dcvalue('access', 'url', item.accessGuidance.accessUrl);\n"
    "  }\n"
    "  if (item.accessGuidance?.instructions) {\n"
    "    crr += dcvalue('access', 'instructions', item.accessGuidance.instructions);\n"
    "  }\n"
    "  if (item.accessGuidance?.restrictionBasis) {\n"
    "    crr += dcvalue(\n"
    "      'access',\n"
    "      'restrictionbasis',\n"
    "      item.accessGuidance.restrictionBasis,\n"
    "    );\n"
    "  }\n"
    '  // Omitted rather than emitted blank. A DOI field present but empty reads as "no DOI exists",\n',
)
replace_once(
    generator,
    "      accessNote: item.accessNote,\n      doi: item.doi,\n",
    "      accessNote: item.accessNote,\n"
    "      ...(item.accessGuidance ? { accessGuidance: item.accessGuidance } : {}),\n"
    "      doi: item.doi,\n",
)

registry = Path("tools/dspace/crr-types.xml")
registry_anchor = """  <dc-type>
    <schema>crr</schema>
    <element>identifier</element>
    <qualifier>doi</qualifier>
"""
registry_fields = """  <dc-type>
    <schema>crr</schema>
    <element>access</element>
    <qualifier>mechanism</qualifier>
    <scope_note>Named mechanism for legitimate access or discovery of a restricted object; descriptive metadata only and does not grant access.</scope_note>
  </dc-type>

  <dc-type>
    <schema>crr</schema>
    <element>access</element>
    <qualifier>url</qualifier>
    <scope_note>Authoritative URL describing legitimate access or discovery for a restricted object; descriptive metadata only and does not grant access.</scope_note>
  </dc-type>

  <dc-type>
    <schema>crr</schema>
    <element>access</element>
    <qualifier>instructions</qualifier>
    <scope_note>Source-authored instructions for legitimate access or discovery of a restricted object; descriptive metadata only and does not grant access.</scope_note>
  </dc-type>

  <dc-type>
    <schema>crr</schema>
    <element>access</element>
    <qualifier>restrictionbasis</qualifier>
    <scope_note>Source-authored basis for the access restriction; descriptive metadata only and does not grant access.</scope_note>
  </dc-type>

"""
replace_once(registry, registry_anchor, registry_fields + registry_anchor)
