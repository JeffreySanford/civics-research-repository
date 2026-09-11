import { Injectable } from '@angular/core';
import { ParamMap, Params } from '@angular/router';
import type {
  ResearchObjectType,
  SearchQuery,
  SourceSystem,
} from 'repository-api-client';

export const MOBILE_SEARCH_PAGE_SIZE = 10;

const SOURCE_SYSTEMS = [
  'CENSUS',
  'USGS',
  'DATA_GOV',
  'DOE_OSTI',
  'NASA_CMR',
  'PUBMED',
  'OPENALEX',
  'OTHER',
] as const satisfies readonly SourceSystem[];

const CONTENT_TYPES = [
  'DATASET',
  'PUBLICATION',
  'CODE',
  'METHODOLOGY',
  'SUPPORTING_MATERIAL',
  'PROJECT',
] as const satisfies readonly ResearchObjectType[];

const SEARCH_PARAM_KEYS = [
  'q',
  'program',
  'publisher',
  'sourceSystem',
  'geography',
  'type',
  'vintageYear',
] as const;

@Injectable({ providedIn: 'root' })
export class SearchRouteQueryAdapter {
  hasSearchIntent(params: ParamMap): boolean {
    return SEARCH_PARAM_KEYS.some((key) => params.has(key));
  }

  fromParamMap(params: ParamMap): SearchQuery {
    const q = this.trimmed(params.get('q'));
    const programs = [
      ...new Set(
        params
          .getAll('program')
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];
    const publisher = this.trimmed(params.get('publisher'));
    const geography = this.trimmed(params.get('geography'));
    const sourceSystem = this.parseSourceSystem(params.get('sourceSystem'));
    const contentType = this.parseContentType(params.get('type'));
    const vintageYear = this.positiveInteger(params.get('vintageYear'));

    return {
      page: 0,
      pageSize: MOBILE_SEARCH_PAGE_SIZE,
      ...(q ? { q } : {}),
      ...(programs.length ? { programs } : {}),
      ...(publisher ? { publisher } : {}),
      ...(sourceSystem ? { sourceSystem } : {}),
      ...(geography ? { geography } : {}),
      ...(contentType ? { contentType } : {}),
      ...(vintageYear !== undefined ? { vintageYear } : {}),
    };
  }

  toQueryParams(query: SearchQuery): Params {
    const q = query.q?.trim();
    const programs = query.programs
      ? [...new Set(query.programs.map((value) => value.trim()).filter(Boolean))]
      : [];

    return {
      q: q || null,
      program: programs.length ? programs : null,
      publisher: query.publisher?.trim() || null,
      sourceSystem: query.sourceSystem ?? null,
      geography: query.geography?.trim() || null,
      type: query.contentType ?? null,
      vintageYear: query.vintageYear ?? null,
    };
  }

  parseSourceSystem(value: string | null): SourceSystem | undefined {
    return SOURCE_SYSTEMS.find((candidate) => candidate === value);
  }

  parseContentType(value: string | null): ResearchObjectType | undefined {
    return CONTENT_TYPES.find((candidate) => candidate === value);
  }

  private positiveInteger(value: string | null): number | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  }

  private trimmed(value: string | null): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }
}
