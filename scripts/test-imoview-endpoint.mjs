const page = await (await fetch("https://www.imobee.net/imoveis/casa-de-condominio-4-suites-gran-royalle-lagoa-santa-300m-4-vagas-lagoa-santa")).text();

// Decode RSC payload - look for address-related escaped strings
const chunks = [...page.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)].map(m => m[1]);
const decoded = chunks.map(c => c.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\'));
const all = decoded.join('\n');

for (const term of ["endereco", "logradouro", "bairro", "cep", "numero", "cidade", "codigo", "titulo", "Lagoa Santa", "Gran Royalle"]) {
  const idx = all.toLowerCase().indexOf(term.toLowerCase());
  if (idx >= 0) {
    console.log(`\n=== ${term} @ ${idx} ===`);
    console.log(all.slice(Math.max(0, idx - 80), idx + 200));
  }
}

// Also check meta tags / structured data
const og = [...page.matchAll(/<meta[^>]+property="og:[^"]+"[^>]+content="([^"]+)"/g)];
console.log("\nOG tags:", og.map(m => m[0]).slice(0, 5));

// JSON-LD
const ld = page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
if (ld) console.log("\nJSON-LD:", ld[1].slice(0, 1000));
