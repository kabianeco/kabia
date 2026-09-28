import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as data from '../content/preview-products.ts';
test('local examples cover explicit producer collections without invented review or certificate data', async()=>{
  assert.ok(data);
  const {producerCollections}=await import('../content/producers.ts');
  assert.deepEqual(producerCollections.secki.map(p=>p.slug),['geyve-setce-findik','ege-ceviz','anadolu-bal','akinci-ihlamur']);
  const producers=Object.values(producerCollections).flat();
  for(const producer of producers) {
    const products=data.previewProducts.filter(p=>p.producerSlug===producer.slug);
    assert.ok(products.length>=1 && products.length<=2);
    for(const product of products) {
      assert.equal(product.source,producer.source);
      assert.ok(product.slug.startsWith('onizleme-'));
      assert.ok(product.id.startsWith('kabia-preview:'));
      assert.ok(product.variants.every(v=>v.id.startsWith('kabia-preview:')));
      assert.equal(product.reviewCount,0); assert.deepEqual(product.reviews,[]); assert.equal(product.certificates,'');
      assert.ok(product.mainImageUrl.startsWith('/images/'));
    }
  }
  assert.equal(producerCollections.mutfak.some(p=>p.slug==='alic-sirkesi'),true);
});
