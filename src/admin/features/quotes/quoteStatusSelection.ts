import {
  getQuoteRequestStatusPresentation,
  getQuoteRequestVisibleStatusValue,
  isManuallyEditableQuoteRequestStatus,
  QUOTE_REQUEST_VISIBLE_STATUS_OPTIONS,
  type ManuallyEditableQuoteRequestStatus,
  type QuoteRequestVisibleStatusOption,
  type QuoteRequestVisibleStatusValue
} from '@/shared/domain/quote/quoteRequestStatus';

export type QuoteRequestStatusSelectionContext = Readonly<{
  currentStatus: string;
  hasIssuedOfferHistory: boolean;
  hasDraft: boolean;
}>;

export type QuoteRequestStatusSelectionOption = QuoteRequestVisibleStatusOption &
  Readonly<{
    disabled: boolean;
    description: string;
  }>;

export const QUOTE_REQUEST_MANUAL_STATUS_TARGET_BY_VISIBLE_VALUE: Readonly<
  Partial<
    Record<QuoteRequestVisibleStatusValue, ManuallyEditableQuoteRequestStatus>
  >
> = {
  preparation: 'in_preparation',
  received: 'received'
};

export function getManualQuoteRequestStatusTarget(
  value: QuoteRequestVisibleStatusValue
): ManuallyEditableQuoteRequestStatus | null {
  return QUOTE_REQUEST_MANUAL_STATUS_TARGET_BY_VISIBLE_VALUE[value] ?? null;
}

const lifecycleActionDescription = (
  value: Exclude<QuoteRequestVisibleStatusValue, 'preparation' | 'received'>,
  context: QuoteRequestStatusSelectionContext
): string => {
  const terminalStatus = [
    'accepted',
    'converted_to_order',
    'declined',
    'closed_without_offer'
  ].includes(context.currentStatus);

  if (value === 'issued') {
    if (terminalStatus) {
      return 'Zaključenega ali naročenega povpraševanja ni mogoče znova označiti kot izdano.';
    }
    if (['expired', 'withdrawn'].includes(context.currentStatus)) {
      return 'Najprej uporabite »Pripravi novo različico«, nato novo ponudbo izdajte z gumbom »Izdaj in pošlji ponudbo«.';
    }
    return context.hasDraft
      ? 'Ponudbo izdajte z gumbom »Izdaj in pošlji ponudbo«.'
      : 'Najprej pripravite osnutek ponudbe, nato uporabite gumb »Izdaj in pošlji ponudbo«.';
  }
  if (value === 'ordered') {
    if (context.currentStatus === 'awaiting_purchase_order_review') {
      return 'Naročilnico najprej potrdite v administrativnem pregledu.';
    }
    if (['declined', 'closed_without_offer'].includes(context.currentStatus)) {
      return 'Zaključenega povpraševanja ni mogoče neposredno označiti kot naročeno.';
    }
    if (['expired', 'withdrawn'].includes(context.currentStatus)) {
      return 'Najprej pripravite in izdajte novo različico; nato jo mora stranka sprejeti ali poslati naročilnico.';
    }
    return 'Status »Naročeno« lahko nastane samo s sprejemom stranke ali s potrditvijo naročilnice v administrativnem pregledu.';
  }
  if (value === 'declined') {
    if (context.currentStatus === 'awaiting_purchase_order_review') {
      return 'Naročilnico najprej zavrnite v administrativnem pregledu.';
    }
    if (['accepted', 'converted_to_order'].includes(context.currentStatus)) {
      return 'Naročenega povpraševanja ni mogoče naknadno označiti kot zavrnjeno.';
    }
    if (context.hasIssuedOfferHistory) {
      return 'Uporabite dejanje »Umakni izdano ponudbo«; zavrnitev stranke se zabeleži iz njenega odgovora.';
    }
    return 'Uporabite dejanje »Zaključi brez izdaje ponudbe«; zavrnitev stranke se zabeleži iz njenega odgovora.';
  }
  return context.hasIssuedOfferHistory
    ? 'Status »Poteklo« se nastavi samodejno ob poteku veljavnosti trenutno izdane ponudbe.'
    : 'Najprej izdajte ponudbo z datumom »Velja do«; status se nato nastavi samodejno ob poteku.';
};

const blockedManualDescription = (
  context: QuoteRequestStatusSelectionContext,
  currentVisibleStatus: QuoteRequestVisibleStatusValue | null
): string => {
  if (context.currentStatus === 'awaiting_purchase_order_review') {
    return 'Najprej potrdite ali zavrnite naročilnico v administrativnem pregledu.';
  }
  if (['accepted', 'converted_to_order'].includes(context.currentStatus)) {
    return 'Naročenega povpraševanja ni mogoče vrniti v predizdajno stanje.';
  }
  if (['declined', 'closed_without_offer'].includes(context.currentStatus)) {
    return 'Zaključenega povpraševanja ni mogoče znova odpreti z ročno spremembo statusa.';
  }
  if (context.hasIssuedOfferHistory) {
    return context.hasDraft
      ? 'Po izdaji se statusa ne da ročno vrniti. Nadaljujte z obstoječim osnutkom in uporabite gumb »Izdaj in pošlji ponudbo«.'
      : 'Po izdaji se statusa ne da ročno vrniti. Uporabite dejanje »Pripravi novo različico«.';
  }
  if (
    currentVisibleStatus &&
    currentVisibleStatus !== 'preparation' &&
    currentVisibleStatus !== 'received'
  ) {
    return `Ročni prehod ni dovoljen. ${lifecycleActionDescription(
      currentVisibleStatus,
      context
    )}`;
  }
  return 'Ročni prehod je dovoljen samo za prejeto povpraševanje ali povpraševanje v pripravi pred prvo izdajo.';
};

export function buildQuoteRequestStatusSelectionOptions(
  context: QuoteRequestStatusSelectionContext
): ReadonlyArray<QuoteRequestStatusSelectionOption> {
  const currentVisibleStatus = getQuoteRequestVisibleStatusValue(
    context.currentStatus
  );
  const canSelectManualStatus =
    isManuallyEditableQuoteRequestStatus(context.currentStatus) &&
    !context.hasIssuedOfferHistory;

  return QUOTE_REQUEST_VISIBLE_STATUS_OPTIONS.map((option) => {
    if (option.value === currentVisibleStatus) {
      return {
        ...option,
        disabled: false,
        description: `Trenutno stanje. ${
          getQuoteRequestStatusPresentation(context.currentStatus).description
        }`
      };
    }

    const manualTarget = getManualQuoteRequestStatusTarget(option.value);
    if (manualTarget) {
      return {
        ...option,
        disabled: !canSelectManualStatus,
        description: canSelectManualStatus
          ? `Ročno nastavi status »${option.label}« pred prvo izdajo ponudbe.`
          : blockedManualDescription(context, currentVisibleStatus)
      };
    }

    return {
      ...option,
      disabled: true,
      description: lifecycleActionDescription(
        option.value as Exclude<
          QuoteRequestVisibleStatusValue,
          'preparation' | 'received'
        >,
        context
      )
    };
  });
}
