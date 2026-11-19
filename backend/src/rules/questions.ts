import type { QuestionDefinition } from "./types.js";

// The questions asked after the organization number, in this order.
// Each question decides itself when it is asked.
export const QUESTIONS: QuestionDefinition[] = [
  {
    id: "vatTerm",
    type: "choice",
    text: {
      nb: "Hvor ofte leverer du mva-melding?",
      en: "How often do you file the VAT return?",
    },
    help: {
      nb: "De fleste leverer annenhver måned. Årstermin må man ha søkt om og fått innvilget.",
      en: "Most businesses file every two months. The annual term must be applied for and granted.",
    },
    options: [
      {
        value: "bimonthly",
        label: { nb: "Annenhver måned", en: "Every two months" },
      },
      {
        value: "annual",
        label: {
          nb: "Én gang i året (årstermin)",
          en: "Once a year (annual term)",
        },
      },
      { value: "unknown", label: { nb: "Vet ikke", en: "I don't know" } },
    ],
    askWhen: (company) => company.vatRegistered,
  },
  {
    id: "expectsSalesOver50k",
    type: "boolean",
    text: {
      nb: "Regner du med å selge for mer enn 50 000 kroner i løpet av 12 måneder?",
      en: "Do you expect to sell for more than NOK 50,000 within 12 months?",
    },
    help: {
      nb: "Beløpet er uten mva og gjelder salg av mva-pliktige varer og tjenester.",
      en: "The amount is excluding VAT and covers sales of goods and services subject to VAT.",
    },
    askWhen: (company) => !company.vatRegistered,
  },
  {
    id: "paysSalary",
    type: "boolean",
    text: {
      nb: "Betaler du lønn, eller skal du begynne å betale lønn?",
      en: "Do you pay salaries, or will you start paying salaries?",
    },
    help: {
      nb: "I et aksjeselskap gjelder dette også lønn til deg selv. Innehaveren av et enkeltpersonforetak tar ikke lønn fra foretaket.",
      en: "In a limited company this includes salary to yourself. The owner of a sole proprietorship does not take a salary from it.",
    },
    askWhen: () => true,
  },
  {
    id: "expectsProfit",
    type: "boolean",
    text: {
      nb: "Regner du med overskudd i år?",
      en: "Do you expect a profit this year?",
    },
    help: {
      nb: "Et enkeltpersonforetak betaler forskuddsskatt når det går med overskudd.",
      en: "A sole proprietorship pays advance tax when it makes a profit.",
    },
    askWhen: (company) => company.organizationForm === "ENK",
  },
];
