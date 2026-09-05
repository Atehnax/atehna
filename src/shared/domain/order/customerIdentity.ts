type CustomerIdentityInput = {
  customerType: string;
  organizationName?: string | null;
  contactName?: string | null;
};

export function getCustomerIdentity({
  customerType,
  organizationName,
  contactName
}: CustomerIdentityInput): { name: string; contact: string } {
  const organization = organizationName?.trim() ?? '';
  const person = contactName?.trim() ?? '';
  if (customerType === 'individual') {
    return { name: person || organization, contact: '' };
  }

  const name = organization || person;
  const comparable = (value: string) => value.replace(/\s+/gu, ' ').toLocaleLowerCase('sl');
  return {
    name,
    contact: person && comparable(person) !== comparable(name) ? person : ''
  };
}
