import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { toCompany } from "../src/mappers/companyMapper.js";
import type { BrregEnhet } from "../src/types/brreg.js";

// A valid organization number (Brønnøysundregistrene)
const ORG_NUMBER = "974760673";

// A fictional sole proprietorship with the same structure as a Brreg response
const enkEnhet: BrregEnhet = {
  organisasjonsnummer: ORG_NUMBER,
  navn: "AYSE FRISØR",
  organisasjonsform: { kode: "ENK", beskrivelse: "Enkeltpersonforetak" },
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
  registrertIMvaregisteret: true,
  registrertIForetaksregisteret: false,
  konkurs: false,
  underAvvikling: false,
  underTvangsavviklingEllerTvangsopplosning: false,
};

// Replaces fetch so the tests never call the real Brreg API
function mockBrreg(status: number, body?: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("toCompany", () => {
  it("maps a Brreg entity to the app's own shape", () => {
    expect(toCompany(enkEnhet)).toEqual({
      orgNumber: ORG_NUMBER,
      name: "AYSE FRISØR",
      organizationForm: "ENK",
      organizationFormDescription: "Enkeltpersonforetak",
      address: {
        postalCode: "3017",
        city: "DRAMMEN",
        municipality: "DRAMMEN",
        municipalityNumber: "3301",
      },
      industryCode: "96.021",
      industryDescription: "Frisering",
      employees: null,
      hasRegisteredEmployees: false,
      foundedDate: "2026-03-01",
      registrationDate: "2026-03-04",
      vatRegistered: true,
      businessRegisterRegistered: false,
      isBankrupt: false,
      isUnderLiquidation: false,
      isUnderForcedLiquidation: false,
    });
  });

  it("treats missing register flags as not registered", () => {
    const { registrertIMvaregisteret, registrertIForetaksregisteret, ...rest } =
      enkEnhet;
    const company = toCompany(rest);

    expect(company.vatRegistered).toBe(false);
    expect(company.businessRegisterRegistered).toBe(false);
  });
});

describe("GET /api/companies/:orgNumber", () => {
  it("returns the company in the app's own shape", async () => {
    const fetchMock = mockBrreg(200, enkEnhet);

    const res = await request(app).get(`/api/companies/${ORG_NUMBER}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      orgNumber: ORG_NUMBER,
      organizationForm: "ENK",
      vatRegistered: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `https://data.brreg.no/enhetsregisteret/api/enheter/${ORG_NUMBER}`,
      expect.anything(),
    );
  });

  it("rejects an invalid organization number without calling Brreg", async () => {
    const fetchMock = mockBrreg(200, enkEnhet);

    const res = await request(app).get("/api/companies/974760674");

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 404 when Brreg does not know the company", async () => {
    mockBrreg(404);

    const res = await request(app).get(`/api/companies/${ORG_NUMBER}`);

    expect(res.status).toBe(404);
  });

  it("returns 410 with the deletion date for a struck-off company", async () => {
    mockBrreg(200, {
      organisasjonsnummer: ORG_NUMBER,
      navn: "AYSE FRISØR",
      respons_klasse: "SlettetEnhet",
      slettedato: "2026-10-01",
    });

    const res = await request(app).get(`/api/companies/${ORG_NUMBER}`);

    expect(res.status).toBe(410);
    expect(res.body.deletedDate).toBe("2026-10-01");
  });

  it("returns 502 when Brreg fails", async () => {
    mockBrreg(500);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await request(app).get(`/api/companies/${ORG_NUMBER}`);

    expect(res.status).toBe(502);
  });

  it("returns 502 when Brreg cannot be reached", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await request(app).get(`/api/companies/${ORG_NUMBER}`);

    expect(res.status).toBe(502);
  });
});
