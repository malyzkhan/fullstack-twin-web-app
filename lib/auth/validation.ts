export function validateEmail(value: string) {
  const email = value.trim();
  if (!email) return "Enter your email address.";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Enter a valid email address.";
  }
  return "";
}

export function validatePassword(value: string) {
  if (!value) return "Enter a password.";
  if (value.length < 12) return "Use at least 12 characters.";
  if (value.length > 128) return "Use 128 characters or fewer.";
  return "";
}

export function validateFullName(value: string) {
  const name = value.trim();
  if (!name) return "Enter your full name.";
  if (name.length < 2 || name.length > 80) {
    return "Your name must be between 2 and 80 characters.";
  }
  return "";
}
