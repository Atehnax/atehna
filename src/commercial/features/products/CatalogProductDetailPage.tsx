import ProductDetailView from '@/commercial/components/storefront/ProductDetailView';
import {
  buildStorefrontProductFromCatalogItem,
  toStorefrontProductSummary,
  type CatalogProductPresentationContext
} from '@/commercial/features/products/storefrontProduct';
import type { CatalogItem } from '@/shared/domain/catalog/catalogTypes';

type CatalogProductDetailPageProps = {
  item: CatalogItem;
  context: CatalogProductPresentationContext;
  related?: Array<{
    item: CatalogItem;
    context: CatalogProductPresentationContext;
  }>;
};

export default function CatalogProductDetailPage({
  item,
  context,
  related = []
}: CatalogProductDetailPageProps) {
  const product = buildStorefrontProductFromCatalogItem(item, context);
  product.relatedProducts = related
    .filter((entry) => entry.item.slug !== item.slug)
    .map((entry) =>
      toStorefrontProductSummary(
        buildStorefrontProductFromCatalogItem(entry.item, entry.context),
        entry.context.subcategory?.title ?? entry.context.category.title
      )
    );
  return <ProductDetailView product={product} />;
}
