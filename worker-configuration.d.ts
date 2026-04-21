interface Env {
  DB: D1Database;
  APP_NAME?: string;
  DEFAULT_ENCRYPT_FIELDS?: string;
  ENCRYPTION_KEY?: string;
  ENCRYPTION_KEY_VERSION?: string;
  SERVICE_PUBLIC_URL?: string;
  MOTHER_REPORT_URL?: string;
  MOTHER_REPORT_TOKEN?: string;
  MOTHER_REPORT_TIMEOUT_MS?: string;
  MOTHER_PUSH_TOKEN?: string;
  WRITE_TOKEN?: string;
  READ_TOKEN?: string;
}
