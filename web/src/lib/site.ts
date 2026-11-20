// Details about the person behind Regelvakt, shown on the about and
// contact pages. An empty value is simply not shown.
interface SiteDetails {
  ownerName: string;
  contactEmail: string;
  linkedInUrl: string;
  portfolioUrl: string;
}

export const SITE: SiteDetails = {
  ownerName: "Devrim Savas Yilmaz",
  // The email address people should write to
  contactEmail: "",
  linkedInUrl: "https://www.linkedin.com/in/devrimsavas/",
  portfolioUrl: "https://www.devrimdev.no",
};
