export class ChatSchemaNotReadyError extends Error {
  constructor() {
    super("TWIN_CHAT_SCHEMA_NOT_READY");
    this.name = "ChatSchemaNotReadyError";
  }
}
