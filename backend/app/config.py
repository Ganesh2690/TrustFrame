from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import json


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://trustframe:trustframe@localhost:5432/trustframe"
    SECRET_KEY: str = "change-me-to-a-random-32-char-string-in-production"
    REPORT_TOKEN_SECRET: str = "change-me-to-a-different-secret-for-reports"
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 500
    CORS_ORIGINS: str = '["http://localhost:3000","http://localhost:5173"]'
    ADMIN_SECRET: str = "admin-password-change-in-production"
    APP_URL: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> List[str]:
        try:
            return json.loads(self.CORS_ORIGINS)
        except Exception:
            return [self.CORS_ORIGINS]

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
