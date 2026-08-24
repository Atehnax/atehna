export type ConfirmationDocumentRow = {
  type: string;
  customer_access_id: string;
};

export type CustomerConfirmationDocument = {
  type: string;
  url: string;
};

type FailureReporter = (error: unknown) => void;

export async function readConfirmationDocumentsSafely(
  readRows: () => Promise<readonly ConfirmationDocumentRow[]>,
  reportFailure: FailureReporter
): Promise<CustomerConfirmationDocument[]> {
  try {
    const rows = await readRows();
    return rows.map((document) => {
      const type = document.type?.trim();
      const customerAccessId = document.customer_access_id?.trim().toLowerCase();
      if (!type || !customerAccessId) {
        throw new Error('Order document returned incomplete customer metadata.');
      }

      return {
        type,
        url: `/api/orders/documents/${encodeURIComponent(customerAccessId)}`
      };
    });
  } catch (error) {
    reportFailure(error);
    return [];
  }
}

export function scheduleConfirmationDocumentRepairSafely(
  schedule: () => void,
  reportFailure: FailureReporter
): void {
  try {
    schedule();
  } catch (error) {
    reportFailure(error);
  }
}
