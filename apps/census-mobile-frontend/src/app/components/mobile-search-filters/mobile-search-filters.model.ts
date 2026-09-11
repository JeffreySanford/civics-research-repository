export type MobileFilterField =
  | 'program'
  | 'publisher'
  | 'sourceSystem'
  | 'geography'
  | 'type'
  | 'vintageYear';

export interface MobileActiveFilter {
  readonly key: string;
  readonly field: MobileFilterField;
  readonly value: string;
  readonly label: string;
}

export interface MobileFilterSelection {
  readonly field: MobileFilterField;
  readonly value: string;
}
