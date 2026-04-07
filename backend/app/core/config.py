from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    openrouter_api_key: str
    model: str = "google/gemini-3.1-flash-lite-preview"
    courtlistener_api_key: str = ""

    class Config:
        env_file = ".env"

settings = Settings()