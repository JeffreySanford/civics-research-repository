import type { DataDrivenPropertyValueSpecification } from 'maplibre-gl';
import type { CountyBusinessPatternsChoropleth } from 'repository-api-client';

export type CountyBusinessPatternsLegendBreak = {
  readonly label: string;
  readonly color: string;
  readonly unavailable?: boolean;
};

export type CountyBusinessPatternsScale = {
  readonly fillColor: DataDrivenPropertyValueSpecification<string>;
  readonly breaks: readonly CountyBusinessPatternsLegendBreak[];
  readonly description: string;
};

const COLORS = ['#ecfdf5', '#a7f3d0', '#34d399', '#059669', '#064e3b'] as const;

export const COUNTY_BUSINESS_PATTERNS_UNAVAILABLE_COLOR = '#d1d5db';

function quantile(sorted: readonly number[], probability: number): number {
  if (sorted.length === 1) {
    return sorted[0];
  }

  const position = (sorted.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex];
  }

  const fraction = position - lowerIndex;
  return (
    sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * fraction
  );
}

function numberLabel(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Builds a deterministic sequential scale from published CBP values only.
 *
 * Unavailable county/industry rows are intentionally excluded from the quantiles and receive a
 * distinct non-value fill. Published zero remains a numeric value and therefore participates in
 * the sequential scale rather than being conflated with unavailable data.
 */
export function buildCountyBusinessPatternsScale(
  choropleth: CountyBusinessPatternsChoropleth,
): CountyBusinessPatternsScale {
  const values = choropleth.counties
    .filter(
      (county) =>
        county.available &&
        county.value !== null &&
        county.value !== undefined &&
        Number.isFinite(county.value),
    )
    .map((county) => county.value as number)
    .sort((left, right) => left - right);

  const unavailableBreak: CountyBusinessPatternsLegendBreak = {
    label: 'Unavailable in published CBP source',
    color: COUNTY_BUSINESS_PATTERNS_UNAVAILABLE_COLOR,
    unavailable: true,
  };

  if (values.length === 0) {
    return {
      fillColor: COUNTY_BUSINESS_PATTERNS_UNAVAILABLE_COLOR,
      breaks: [unavailableBreak],
      description:
        'No published numeric county values are available for the selected industry. Unavailable does not mean zero.',
    };
  }

  const first = values[0];
  const thresholds = [0.2, 0.4, 0.6, 0.8]
    .map((probability) => quantile(values, probability))
    .filter(
      (value, index, all) =>
        value > first && (index === 0 || value > all[index - 1]),
    );

  let numericExpression: DataDrivenPropertyValueSpecification<string>;
  let numericBreaks: CountyBusinessPatternsLegendBreak[];

  if (thresholds.length === 0) {
    numericExpression = COLORS[2];
    numericBreaks = [
      {
        label: `All published counties: ${numberLabel(first)}`,
        color: COLORS[2],
      },
    ];
  } else {
    const expression: unknown[] = [
      'step',
      ['to-number', ['get', 'value']],
      COLORS[0],
    ];
    thresholds.forEach((threshold, index) => {
      expression.push(
        threshold,
        COLORS[Math.min(index + 1, COLORS.length - 1)],
      );
    });
    numericExpression =
      expression as DataDrivenPropertyValueSpecification<string>;

    const colors = COLORS.slice(0, thresholds.length + 1);
    numericBreaks = colors.map((color, index) => {
      if (index === 0) {
        return { color, label: `< ${numberLabel(thresholds[0])}` };
      }
      if (index === colors.length - 1) {
        return {
          color,
          label: `≥ ${numberLabel(thresholds[thresholds.length - 1])}`,
        };
      }
      return {
        color,
        label: `${numberLabel(thresholds[index - 1])} to < ${numberLabel(
          thresholds[index],
        )}`,
      };
    });
  }

  return {
    fillColor: [
      'case',
      ['==', ['get', 'available'], false],
      COUNTY_BUSINESS_PATTERNS_UNAVAILABLE_COLOR,
      numericExpression,
    ] as DataDrivenPropertyValueSpecification<string>,
    breaks: [...numericBreaks, unavailableBreak],
    description:
      'Sequential quantile thresholds are derived only from published county values; darker green indicates a larger value. Gray means the selected county/industry row is unavailable, not zero.',
  };
}
