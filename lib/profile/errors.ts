export const PROFILE_SCHEMA_NOT_READY = "TWIN_PROFILE_SCHEMA_NOT_READY";
export const DISCOVER_SCHEMA_NOT_READY = "TWIN_DISCOVER_SCHEMA_NOT_READY";

type DatabaseErrorLike = {
  code?: string;
  message?: string;
};

export function throwIfProfileSchemaMissing(error: DatabaseErrorLike) {
  if (
    error.code === "PGRST205" ||
    error.code === "PGRST202" ||
    error.code === "42P01" ||
    error.code === "42883"
  ) {
    throw new Error(PROFILE_SCHEMA_NOT_READY);
  }
  throw error;
}
