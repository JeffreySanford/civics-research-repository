from pathlib import Path

component_path = Path("apps/discovery-ui/src/app/pages/admin-corpus-storage.component.ts")
component = component_path.read_text()

admin_import = "  RepositoryAdminApi,\n"
corpus_import = "  RepositoryCorpusStorageApi,\n"
if component.count(admin_import) != 1:
    raise SystemExit("Expected exactly one RepositoryAdminApi import in corpus storage component")
component = component.replace(admin_import, corpus_import, 1)

admin_inject = "inject(RepositoryAdminApi)"
corpus_inject = "inject(RepositoryCorpusStorageApi)"
if component.count(admin_inject) != 1:
    raise SystemExit("Expected exactly one RepositoryAdminApi injection in corpus storage component")
component = component.replace(admin_inject, corpus_inject, 1)
component_path.write_text(component)

pipeline_path = Path("apps/discovery-ui/src/app/pages/admin-viz/sync-pipeline.component.ts")
pipeline = pipeline_path.read_text()

import_anchor = "import { adminFlowStepEnter } from './admin-viz.animations';\n"
component_import = "import { AdminCorpusStorageComponent } from '../admin-corpus-storage.component';\n"
if component_import not in pipeline:
    if pipeline.count(import_anchor) != 1:
        raise SystemExit("Expected exactly one pipeline import anchor")
    pipeline = pipeline.replace(import_anchor, component_import + import_anchor, 1)

metadata_anchor = "  changeDetection: ChangeDetectionStrategy.OnPush,\n"
imports_line = "  imports: [AdminCorpusStorageComponent],\n"
if imports_line not in pipeline:
    if pipeline.count(metadata_anchor) != 1:
        raise SystemExit("Expected exactly one pipeline metadata anchor")
    pipeline = pipeline.replace(metadata_anchor, metadata_anchor + imports_line, 1)

template_anchor = "    </figure>\n"
component_tag = "    <app-admin-corpus-storage />\n"
if component_tag not in pipeline:
    if pipeline.count(template_anchor) != 1:
        raise SystemExit("Expected exactly one pipeline figure closing tag")
    pipeline = pipeline.replace(template_anchor, template_anchor + component_tag, 1)

pipeline_path.write_text(pipeline)
