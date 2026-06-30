import filterOptions from '@/data/filter-options.json';
import { FilterOptions } from '@/types/travel';

export function loadFilterOptions(): FilterOptions {
  return filterOptions;
}
