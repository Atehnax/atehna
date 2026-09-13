import assert from 'node:assert/strict';
import test from 'node:test';
import { canOptimizeHomepageImage } from '../../src/commercial/components/landing/heroImage';

test('hero optimization accepts configured public media without restricting other slide sources', () => {
  assert.equal(canOptimizeHomepageImage('/images/landing/laser-cutting-plywood.png'), true);
  assert.equal(canOptimizeHomepageImage('https://store.public.blob.vercel-storage.com/landing/image.png'), true);
  for (const source of [
    'blob:https://atehna.si/preview',
    'data:image/png;base64,aGVsbG8=',
    '/api/private-image',
    'https://other.example/slide.png',
    '//other.example/slide.png',
    'https://store.public.blob.vercel-storage.com.evil.example/slide.png',
    'http://store.public.blob.vercel-storage.com/slide.png',
    'https://store.public.blob.vercel-storage.com:8443/slide.png',
    'relative-preview.png'
  ]) assert.equal(canOptimizeHomepageImage(source), false, source);
});


test('hero optimization recognizes raster pathname extensions while preserving query strings', () => {
  for (const source of [
    '/images/Hero.PNG?revision=2',
    '/images/hero.JpEg',
    '/images/hero.jpg',
    '/images/hero.WEBP?download=image.svg',
    '/images/hero.GIF',
    'https://store.public.blob.vercel-storage.com/landing/image.PNG?revision=2'
  ]) assert.equal(canOptimizeHomepageImage(source), true, source);
});

test('hero optimization preserves SVG views, fragments, animation and unknown media sources', () => {
  for (const source of [
    '/images/valid.svg#view',
    '/images/valid.SVG?revision=2',
    '/images/valid.SVG?revision=2#view',
    '/images/hero.png#view',
    '/images/hero.png#',
    '/images/animated.avif',
    '/images/animated.AVIF?revision=2',
    '/images/extensionless',
    '/images/unknown.custom?filename=hero.png',
    '/api/private-image.png',
    '/images/../api/private-image.png',
    'https://store.public.blob.vercel-storage.com/landing/valid.svg#view',
    'https://store.public.blob.vercel-storage.com/landing/animated.avif',
    'https://user:password@store.public.blob.vercel-storage.com/landing/private.png'
  ]) assert.equal(canOptimizeHomepageImage(source), false, source);
});
