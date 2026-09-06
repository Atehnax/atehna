export const dynamic = 'force-dynamic';

function retiredLogoEditor() {
  return Response.json(
    { message: 'Prejšnji urejevalnik logotipov je odstranjen. Uporabite knjižnico logotipov.' },
    { status: 410, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } }
  );
}

export const GET = retiredLogoEditor;
export const PUT = retiredLogoEditor;
