import { generateOrderDocumentRoute } from '../../generateOrderDocumentRoute';

export async function POST(request: Request, props: { params: Promise<{ orderId: string }> }) {
  return generateOrderDocumentRoute(request, props, 'Predračun', 'predracun');
}
