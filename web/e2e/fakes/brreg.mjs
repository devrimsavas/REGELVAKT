// A stand-in for Brønnøysundregistrene's API in the end-to-end tests:
// fictional companies, so the tests do not depend on the real register or
// on what real companies look like this week. The API is pointed here
// with BRREG_API_URL.
import http from "node:http";

const PORT = Number(process.env.PORT || 4010);

const base = {
  forretningsadresse: {
    adresse: ["Bragernes Torg 1"],
    postnummer: "3017",
    poststed: "DRAMMEN",
    kommune: "DRAMMEN",
    kommunenummer: "3301",
  },
  naeringskode1: { kode: "96.021", beskrivelse: "Frisering" },
  harRegistrertAntallAnsatte: false,
  stiftelsesdato: "2026-03-01",
  registreringsdatoEnhetsregisteret: "2026-03-04",
  registrertIForetaksregisteret: false,
  konkurs: false,
  underAvvikling: false,
  underTvangsavviklingEllerTvangsopplosning: false,
};

// Organization numbers with a valid check digit
export const COMPANIES = {
  // A sole proprietorship in the VAT register
  974760673: {
    ...base,
    organisasjonsnummer: "974760673",
    navn: "TESTFRISØR ENK",
    organisasjonsform: { kode: "ENK", beskrivelse: "Enkeltpersonforetak" },
    registrertIMvaregisteret: true,
  },
  // A limited company in the VAT register
  918794727: {
    ...base,
    organisasjonsnummer: "918794727",
    navn: "TESTSELSKAP AS",
    organisasjonsform: { kode: "AS", beskrivelse: "Aksjeselskap" },
    registrertIMvaregisteret: true,
    registrertIForetaksregisteret: true,
  },
  // An organization form the rules do not cover
  911111128: {
    ...base,
    organisasjonsnummer: "911111128",
    navn: "TESTFILIAL NUF",
    organisasjonsform: {
      kode: "NUF",
      beskrivelse: "Norskregistrert utenlandsk foretak",
    },
    registrertIMvaregisteret: false,
  },
  // A bankrupt limited company
  911111136: {
    ...base,
    organisasjonsnummer: "911111136",
    navn: "KONKURS AS",
    organisasjonsform: { kode: "AS", beskrivelse: "Aksjeselskap" },
    registrertIMvaregisteret: false,
    konkurs: true,
  },
};
// Struck off the register, and a register that does not answer
const STRUCK_OFF = "911111144";
const DOWN = "911111152";

http
  .createServer((req, res) => {
    const match = /^\/enheter\/(\d{9})$/.exec(req.url ?? "");
    if (!match) {
      res.writeHead(404).end();
      return;
    }
    const org = match[1];
    if (org === STRUCK_OFF) {
      res.writeHead(410).end();
    } else if (org === DOWN) {
      res.writeHead(503).end("down");
    } else if (COMPANIES[org]) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(COMPANIES[org]));
    } else {
      res.writeHead(404).end();
    }
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log(`Fake Brreg on http://127.0.0.1:${PORT}`);
  });
