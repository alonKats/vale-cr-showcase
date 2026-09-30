/* One place emits structured data, so there is one place to audit what the site
   claims about itself in machine-readable form.

   `JSON.stringify` is the escape: the payload is composed from the artifact in
   lib/seo.ts, never from user input, and `<` is escaped so a value containing
   "</script>" cannot close the tag. */

export function JsonLd({ data }: { data: Record<string, unknown>[] }) {
  const payload = JSON.stringify(data.length === 1 ? data[0] : data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: payload }} />;
}
