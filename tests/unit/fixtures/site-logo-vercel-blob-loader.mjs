const mockModule = `
  export async function head(pathname) {
    const value = globalThis.__siteLogoHeadResponse;
    if (!value) throw new Error('Missing site-logo head fixture');
    return { ...value, pathname: value.pathname ?? pathname };
  }
`;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@vercel/blob') {
    return {
      url: `data:text/javascript,${encodeURIComponent(mockModule)}`,
      shortCircuit: true
    };
  }
  return nextResolve(specifier, context);
}
