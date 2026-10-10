import assert from 'node:assert/strict';
import test from 'node:test';
import { readPromotedListPrice } from './promoted-list-price';

test('original total and discount are mapped only when the provider sent a positive value', () => {
  assert.deepEqual(
    readPromotedListPrice({ originalTotalPrice: 4678, discountPercentage: 16, totalPrice: 3928 }),
    { originalTotalPrice: 4678, discountPercentage: 16 },
  );
  assert.deepEqual(
    readPromotedListPrice({ originalTotalPrice: 1783, discountPercentage: 7, totalPrice: 1648 }),
    { originalTotalPrice: 1783, discountPercentage: 7 },
  );
  assert.deepEqual(readPromotedListPrice({ originalTotalPrice: 0, discountPercentage: 0, totalPrice: 1648 }), {});
  assert.deepEqual(readPromotedListPrice({ totalPrice: 1648 }), {});
  assert.deepEqual(readPromotedListPrice({ originalTotalPrice: 2000, discountPercentage: 100 }), {
    originalTotalPrice: 2000,
  });
  assert.deepEqual(readPromotedListPrice(null), {});
});
