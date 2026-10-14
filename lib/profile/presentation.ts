const profileValueLabels: Record<string, string> = {
  atheist: "Atheist",
  agnostic: "Agnostic",
  irreligious: "Irreligious",
  humanist: "Humanist",
  spiritual_but_not_religious: "Spiritual but not religious",
  prefer_not_to_say: "Prefer not to say",
  open_to_discussing: "Open to discussing",
  open_to_see: "Open to seeing where it goes",
  long_term: "Long-term relationship",
  consensual_non_monogamy: "Consensual non-monogamy",
  wants_children: "Wants children",
  childfree: "Childfree",
  yes: "Yes",
  no: "No",
};

export function formatProfileValue(value: string | null | undefined) {
  if (!value) return "";
  return profileValueLabels[value] ??
    value
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
}
