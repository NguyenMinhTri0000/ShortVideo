import os
import json
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, List


class AIProvider:
    """Base interface for AI Providers."""

    def __init__(self, api_key: str = "", model: str = ""):
        self.api_key = api_key
        self.model = model

    def generate(self, prompt: str, system_prompt: str = "") -> str:
        raise NotImplementedError


class GeminiProvider(AIProvider):
    def __init__(self, api_key: str = "", model: str = "gemini-1.5-flash"):
        super().__init__(api_key, model)
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY", "")

    def generate(self, prompt: str, system_prompt: str = "") -> str:
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not configured.")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        headers = {"Content-Type": "application/json"}
        
        full_text = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        payload = {
            "contents": [{"parts": [{"text": full_text}]}]
        }

        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data["candidates"][0]["content"]["parts"][0]["text"]
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"Gemini API HTTP Error {e.code}: {e.read().decode('utf-8')}")


class OpenAICompatibleProvider(AIProvider):
    def __init__(self, api_key: str = "", model: str = "gpt-4o-mini", base_url: str = "https://api.openai.com/v1"):
        super().__init__(api_key, model)
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY", "")

    def generate(self, prompt: str, system_prompt: str = "") -> str:
        if not self.api_key:
            raise ValueError("API Key is not configured for OpenAI compatible provider.")

        url = f"{self.base_url}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.2
        }

        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"OpenAI API HTTP Error {e.code}: {e.read().decode('utf-8')}")


class AgentExecutor:
    """Executes coding task prompt against configured AI Provider or Agent runtime."""

    def __init__(self, provider_type: str = "auto", api_key: str = "", model: str = ""):
        self.provider_type = provider_type
        self.provider = self._init_provider(provider_type, api_key, model)

    def _init_provider(self, provider_type: str, api_key: str, model: str) -> AIProvider:
        if provider_type == "gemini" or (provider_type == "auto" and os.environ.get("GEMINI_API_KEY")):
            return GeminiProvider(api_key=api_key, model=model or "gemini-1.5-flash")
        elif provider_type == "openai" or (provider_type == "auto" and os.environ.get("OPENAI_API_KEY")):
            return OpenAICompatibleProvider(api_key=api_key, model=model or "gpt-4o-mini")
        elif provider_type == "groq" or (provider_type == "auto" and os.environ.get("GROQ_API_KEY")):
            return OpenAICompatibleProvider(
                api_key=api_key or os.environ.get("GROQ_API_KEY", ""),
                model=model or "llama-3.3-70b-versatile",
                base_url="https://api.groq.com/openai/v1"
            )
        elif provider_type == "deepseek" or (provider_type == "auto" and os.environ.get("DEEPSEEK_API_KEY")):
            return OpenAICompatibleProvider(
                api_key=api_key or os.environ.get("DEEPSEEK_API_KEY", ""),
                model=model or "deepseek-chat",
                base_url="https://api.deepseek.com/v1"
            )
        else:
            # Fallback mock/dry-run provider if no API keys configured
            return GeminiProvider(api_key=api_key, model=model or "gemini-1.5-flash")

    def execute_prompt(self, compiled_prompt: str) -> Dict[str, Any]:
        """Execute compiled task prompt."""
        system_instruction = (
            "You are an expert AI Coding Agent. Execute the given Coding Task Specification. "
            "Follow all constraints, file modify targets, acceptance criteria, and testing instructions."
        )
        try:
            response = self.provider.generate(compiled_prompt, system_prompt=system_instruction)
            return {
                "status": "SUCCESS",
                "output": response,
                "provider": self.provider.__class__.__name__
            }
        except Exception as e:
            return {
                "status": "ERROR",
                "error": str(e),
                "provider": self.provider.__class__.__name__
            }
