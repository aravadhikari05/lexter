from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    openrouter_api_key: str
    model: str = "openai/gpt-4o-mini"
    courtlistener_api_key: str = ""

    class Config:
        env_file = ".env"

settings = Settings()