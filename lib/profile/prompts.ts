export const profilePrompts = {
  values: "What values matter most to you?",
  meaning: "What does a meaningful life mean to you?",
  conversations: "What kind of conversations do you enjoy?",
  autonomy: "What are your views on personal autonomy or ethics?",
  social_issues: "Which social issues matter to you?",
  changed_mind: "What is something you have changed your mind about?",
} as const;

export type ProfilePromptKey = keyof typeof profilePrompts;

export function getAnsweredPrompts(answers: Record<string, string>) {
  return Object.entries(profilePrompts)
    .map(([key, question]) => {
      const answer = answers[key];
      return {
        key,
        question,
        answer: typeof answer === "string" ? answer.trim() : "",
      };
    })
    .filter((prompt) => prompt.answer.length > 0);
}
