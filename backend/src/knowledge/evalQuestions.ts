// Questions a small business owner might ask, with the part of the address
// of a page that answers them. Used by `npm run eval:assistant` to measure
// how often search finds a right page among its first five sources.
export interface EvalQuestion {
  question: string;
  // Any source whose address contains one of these counts as found
  expected: string[];
}

const MVA = "/avgifter/mva/";
const SKATTEMELDING = "/skattemelding-naringsdrivende/";
const FORSKUDD = "forskudd";
const A_MELDING = "/a-meldingen/";
const AGA = "/arbeidsgiveravgift/";
const AKSJONAER = "rf-1086";
const ARSREGNSKAP = ["arsregnskap", "annual-accounts"];
const REGNSKAP = "regnskap";
const GENERALFORSAMLING = "generalforsamling";

export const EVAL_QUESTIONS: EvalQuestion[] = [
  { question: "Når må jeg levere mva-meldingen?", expected: [MVA] },
  { question: "Hvor ofte skal mva-meldingen leveres?", expected: [MVA] },
  {
    question: "Må jeg levere mva-melding hvis jeg ikke har solgt noe?",
    expected: [MVA],
  },
  { question: "Kan jeg levere mva én gang i året?", expected: [MVA] },
  { question: "Hva er årstermin for mva?", expected: [MVA] },
  { question: "When is the VAT return due in Norway?", expected: [MVA] },
  {
    question: "Når må jeg registrere meg i Merverdiavgiftsregisteret?",
    expected: [MVA],
  },
  {
    question: "Hvordan leverer jeg skattemelding for enkeltpersonforetak?",
    expected: [SKATTEMELDING],
  },
  {
    question: "Når er fristen for skattemeldingen for aksjeselskap?",
    expected: [SKATTEMELDING],
  },
  {
    question: "Kan et AS levere skattemeldingen uten regnskapsprogram?",
    expected: [SKATTEMELDING],
  },
  {
    question: "What is the tax return deadline for a limited company?",
    expected: [SKATTEMELDING],
  },
  {
    question: "Når betaler jeg forskuddsskatt som selvstendig næringsdrivende?",
    expected: [FORSKUDD],
  },
  {
    question: "Hvor mange terminer har forskuddsskatt for enkeltpersonforetak?",
    expected: [FORSKUDD],
  },
  {
    question: "Når forfaller forskuddsskatten for aksjeselskap?",
    expected: [FORSKUDD],
  },
  {
    question: "How do I pay advance tax for my company?",
    expected: [FORSKUDD],
  },
  { question: "Hvem må levere a-melding?", expected: [A_MELDING] },
  {
    question: "Må jeg levere a-melding hvis jeg ikke har betalt lønn?",
    expected: [A_MELDING],
  },
  { question: "Når er fristen for a-meldingen?", expected: [A_MELDING] },
  {
    question:
      "Do I need to file an a-melding if I pay myself a salary from my AS?",
    expected: [A_MELDING],
  },
  { question: "Når skal arbeidsgiveravgift betales?", expected: [AGA] },
  { question: "Hvordan betaler jeg forskuddstrekk?", expected: [AGA] },
  {
    question: "When do I pay employer's national insurance contributions?",
    expected: [AGA],
  },
  { question: "Hva er aksjonærregisteroppgaven?", expected: [AKSJONAER] },
  {
    question: "Når må aksjonærregisteroppgaven leveres?",
    expected: [AKSJONAER],
  },
  {
    question: "Når må årsregnskapet sendes til Regnskapsregisteret?",
    expected: ARSREGNSKAP,
  },
  {
    question: "Hva skjer hvis årsregnskapet leveres for sent?",
    expected: ARSREGNSKAP,
  },
  {
    question: "When must annual accounts be submitted?",
    expected: ARSREGNSKAP,
  },
  {
    question: "Hvor lenge må jeg ta vare på kvitteringer?",
    expected: [REGNSKAP],
  },
  { question: "Hva betyr bokføringsplikt?", expected: [REGNSKAP] },
  {
    question: "Når må generalforsamlingen holdes?",
    expected: [GENERALFORSAMLING],
  },
];
