/**
 * Locale-aware crisis resource directory. Used by the assessment crisis
 * interstitial, the result-page Safety card, and any future surface that
 * needs to surface trained-human support paths.
 */

export type ResourceType = "phone" | "sms" | "url";

export interface CrisisResource {
  id: string;
  /** "et" | "us" | "uk" | "intl" — used to pick a country-local resource first. */
  locale: "et" | "us" | "uk" | "intl";
  name: string;
  /** Short human-facing string (number or instruction). */
  contact: string;
  type: ResourceType;
  /** Click-ready URL (tel:, sms:, https:). Mobile triggers a call/sms. */
  href: string;
}

const RESOURCES: CrisisResource[] = [
  {
    id: "et-mh",
    locale: "et",
    name: "Ethiopian Mental Health Support",
    contact: "251-111-234-567",
    type: "phone",
    href: "tel:+251111234567",
  },
  {
    id: "et-emerg",
    locale: "et",
    name: "Emergency Services (Ethiopia)",
    contact: "911",
    type: "phone",
    href: "tel:911",
  },
  {
    id: "us-988",
    locale: "us",
    name: "988 Suicide & Crisis Lifeline",
    contact: "988",
    type: "phone",
    href: "tel:988",
  },
  {
    id: "us-text",
    locale: "intl",
    name: "Crisis Text Line",
    contact: "Text HOME to 741741",
    type: "sms",
    href: "sms:741741&body=HOME",
  },
  {
    id: "uk-samaritans",
    locale: "uk",
    name: "Samaritans",
    contact: "116 123",
    type: "phone",
    href: "tel:116123",
  },
  {
    id: "iasp",
    locale: "intl",
    name: "International Association for Suicide Prevention",
    contact: "Find a centre by country",
    type: "url",
    href: "https://www.iasp.info/resources/Crisis_Centres/",
  },
];

/**
 * Return up to 4 resources, country-first then international. Treats locale
 * "am" as Ethiopia; everything else defaults to US ordering.
 */
export function getCrisisResources(locale: string): CrisisResource[] {
  const country: CrisisResource["locale"] =
    locale === "am" ? "et" : locale.startsWith("en-gb") ? "uk" : "us";
  const local = RESOURCES.filter((r) => r.locale === country);
  const intl = RESOURCES.filter((r) => r.locale === "intl");
  return [...local, ...intl].slice(0, 4);
}
