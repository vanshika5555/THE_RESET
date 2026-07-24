// Which sizes make sense for a given category and fit.
// Shared by the Add and Edit forms so they can never disagree.

export const SIZE_OPTIONS = {
  Men: {
    Top:    ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    Bottom: ['28', '30', '32', '34', '36', '38'],
  },
  Women: {
    Top:    ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    Bottom: ['6', '8', '10', '12', '14', '16'],
  },
};

// Subcategories that are worn on the lower body.
const BOTTOM_WORDS = [
  'trouser', 'pant', 'short', 'denim', 'chino', 'jean',
  'skirt', 'palazzo', 'cargo',
];

// A sensible default when adding a product, based on what it is.
export function guessFitType(subcategory = '') {
  const s = subcategory.toLowerCase();
  return BOTTOM_WORDS.some(w => s.includes(w)) ? 'Bottom' : 'Top';
}

export function sizesFor(category, fitType) {
  return (SIZE_OPTIONS[category] || SIZE_OPTIONS.Men)[fitType === 'Bottom' ? 'Bottom' : 'Top'];
}