import assert from 'node:assert/strict';
import { test } from 'node:test';
const listing = await import('../lib/store-listing.ts').catch(() => null);
// Category is the database slug plus the administered name, so a category an
// administrator adds carries its own label through the storefront instead of
// being collapsed into one of five hardcoded slugs.
const products = [
  { id:'a',category:'cig-badem',categoryName:'Çiğ Badem',categorySortOrder:10,source:'ciftlik',price:30 },
  { id:'b',category:'paketli-urunler',categoryName:'Paketli Ürünler',categorySortOrder:20,source:'secki',price:20 },
  { id:'c',category:'paketli-urunler',categoryName:'Paketli Ürünler',categorySortOrder:20,source:'mutfak',price:10 },
  { id:'d',category:'paketli-urunler',categoryName:'Paketli Ürünler',categorySortOrder:20,source:'secki',price:20 },
];
test('default preserves order, price sorts are stable and source/category pairs filter together', () => {
  assert.ok(listing);
  const ids=(s:string,c='tumu',source='tumu')=>listing.selectProducts(products as never,c,source,s).map((p:{id:string})=>p.id);
  assert.deepEqual(ids('onerilen'),['a','b','c','d']);
  assert.deepEqual(ids('fiyat-artan'),['c','b','d','a']);
  assert.deepEqual(ids('fiyat-azalan'),['a','b','d','c']);
  assert.deepEqual(ids('onerilen','paketli-urunler','secki'),['b','d']);
  assert.deepEqual(ids('onerilen','cig-badem','mutfak'),[]);
});

test('the bar offers only sources and categories the catalogue actually has', () => {
  assert.ok(listing);
  const ids = (list:{id:string}[]) => list.map(entry => entry.id);
  assert.deepEqual(ids(listing.presentSources(products as never)),['tumu','ciftlik','secki','mutfak']);
  // Narrowed to one source, only that source's categories are offered.
  assert.deepEqual(ids(listing.presentCategories(products as never,'ciftlik')),['tumu','cig-badem']);
  assert.deepEqual(ids(listing.presentCategories(products as never,'secki')),['tumu','paketli-urunler']);
  assert.deepEqual(ids(listing.presentCategories(products as never,'tumu')),['tumu','cig-badem','paketli-urunler']);
  // A catalogue missing a source never offers it.
  const farmOnly = [products[0]];
  assert.deepEqual(ids(listing.presentSources(farmOnly as never)),['tumu','ciftlik']);
});

test('a category an administrator added is offered under its own name', () => {
  assert.ok(listing);
  // Nothing in the code knows this slug. Before categories came from the
  // table it was silently relabelled "Çiğ Badem" alongside its source.
  const withNewCategory = [
    ...products,
    { id:'e',category:'tarhana-corbalik',categoryName:'Tarhana ve Çorbalık',categorySortOrder:30,source:'mutfak',price:160 },
  ];
  const offered = listing.presentCategories(withNewCategory as never,'mutfak');
  assert.deepEqual(
    offered.map((entry:{id:string;label:string}) => [entry.id, entry.label]),
    [['tumu','Tümü'],['paketli-urunler','Paketli Ürünler'],['tarhana-corbalik','Tarhana ve Çorbalık']],
  );
  assert.deepEqual(
    listing.selectProducts(withNewCategory as never,'tarhana-corbalik','tumu','onerilen').map((p:{id:string})=>p.id),
    ['e'],
  );
});

test('the curated sort_order decides the bar order, not the name', () => {
  assert.ok(listing);
  const curated = [
    { id:'x',category:'zeytin',categoryName:'Zeytin',categorySortOrder:0,source:'secki',price:1 },
    { id:'y',category:'incir',categoryName:'İncir',categorySortOrder:10,source:'secki',price:1 },
    { id:'z',category:'ceviz',categoryName:'Ceviz',categorySortOrder:20,source:'secki',price:1 },
  ];
  assert.deepEqual(
    listing.presentCategories(curated as never,'tumu').map((entry:{id:string})=>entry.id),
    ['tumu','zeytin','incir','ceviz'],
  );
});

test('equal orders fall back to the Turkish name so the bar stays stable', () => {
  assert.ok(listing);
  const unordered = [
    { id:'x',category:'zeytin',categoryName:'Zeytin',categorySortOrder:0,source:'secki',price:1 },
    { id:'y',category:'incir',categoryName:'İncir',categorySortOrder:0,source:'secki',price:1 },
    { id:'z',category:'ceviz',categoryName:'Ceviz',categorySortOrder:0,source:'secki',price:1 },
  ];
  assert.deepEqual(
    listing.presentCategories(unordered as never,'tumu').map((entry:{id:string})=>entry.id),
    ['tumu','ceviz','incir','zeytin'],
  );
});

test('a product whose category could not be read is not filed under another category', () => {
  assert.ok(listing);
  const withUnknown = [
    products[0],
    { id:'f',category:'',categoryName:'',source:'secki',price:5 },
  ];
  // It must not appear under cig-badem, and it must not invent an option.
  assert.deepEqual(
    listing.presentCategories(withUnknown as never,'tumu').map((entry:{id:string})=>entry.id),
    ['tumu','cig-badem'],
  );
  assert.deepEqual(
    listing.selectProducts(withUnknown as never,'cig-badem','tumu','onerilen').map((p:{id:string})=>p.id),
    ['a'],
  );
  // It is still sold — "Tümü" shows everything.
  assert.deepEqual(
    listing.selectProducts(withUnknown as never,'tumu','tumu','onerilen').map((p:{id:string})=>p.id),
    ['a','f'],
  );
});

test('the card metadata line never shows a dangling separator', async () => {
  const { productMetaLine } = await import('../lib/products.ts');
  assert.equal(
    productMetaLine({ categoryName: 'Çiğ Badem', source: 'ciftlik' } as never),
    'Çiğ Badem • Kabia Çiftliği',
  );
  // Category unreadable: the source still reads, without a leading bullet.
  assert.equal(productMetaLine({ categoryName: '', source: 'mutfak' } as never), 'Kabia Mutfak');
});

test('listingHref keeps the existing parameters and omits defaults', () => {
  assert.ok(listing);
  assert.equal(listing.listingHref('/magaza','tumu','tumu','onerilen'),'/magaza');
  assert.equal(listing.listingHref('/magaza','cig-badem','ciftlik','fiyat-artan'),'/magaza?kategori=cig-badem&kaynak=ciftlik&sirala=fiyat-artan');
  assert.equal(listing.listingHref('/magaza/tarhana','tumu','tumu','fiyat-azalan'),'/magaza/tarhana?sirala=fiyat-azalan');
});
