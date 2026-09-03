import { readFileSync, writeFileSync } from 'node:fs';

const path = 'apps/discovery-ui/src/app/pages/maps-page.ts';
let text = readFileSync(path, 'utf8');

function replaceOnce(needle, replacement, label) {
  const index = text.indexOf(needle);
  if (index < 0) throw new Error(`Missing patch target: ${label}`);
  if (text.indexOf(needle, index + needle.length) >= 0) {
    throw new Error(`Patch target is not unique: ${label}`);
  }
  text = text.slice(0, index) + replacement + text.slice(index + needle.length);
}

replaceOnce(
  `      .subscribe((boundary) => {\n        this.pendingBoundary = boundary;\n        this.renderCensusBoundary();\n      });`,
  `      .subscribe((boundary) => {\n        this.pendingBoundary = boundary;\n        this.renderCensusBoundary();\n        // Research coverage has an accessible semantic surface even if WebGL is unavailable.\n        // The selected Census boundary is therefore the initial bounded viewport; once MapLibre\n        // is ready, moveend replaces it with the actual interactive viewport.\n        this.researchCoverageRequestFingerprint = '';\n        this.scheduleResearchCoverageRefresh(0);\n      });`,
  'selected boundary coverage refresh',
);

replaceOnce(
  `  private currentResearchViewport(): ResearchSpatialViewport | null {\n    if (!this.map) {\n      return null;\n    }\n\n    const bounds = this.map.getBounds();\n    return {\n      west: this.normalizeLongitude(bounds.getWest()),\n      south: Math.max(-90, Math.min(90, bounds.getSouth())),\n      east: this.normalizeLongitude(bounds.getEast()),\n      north: Math.max(-90, Math.min(90, bounds.getNorth())),\n    };\n  }`,
  `  private currentResearchViewport(): ResearchSpatialViewport | null {\n    if (this.map) {\n      const bounds = this.map.getBounds();\n      return {\n        west: this.normalizeLongitude(bounds.getWest()),\n        south: Math.max(-90, Math.min(90, bounds.getSouth())),\n        east: this.normalizeLongitude(bounds.getEast()),\n        north: Math.max(-90, Math.min(90, bounds.getNorth())),\n      };\n    }\n\n    if (this.pendingBoundary) {\n      return {\n        west: this.pendingBoundary.west,\n        south: this.pendingBoundary.south,\n        east: this.pendingBoundary.east,\n        north: this.pendingBoundary.north,\n      };\n    }\n\n    return null;\n  }`,
  'accessible viewport fallback',
);

writeFileSync(path, text);
