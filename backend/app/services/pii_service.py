import re
from typing import Tuple, List, Dict, Any

class PIIService:
    def __init__(self):
        # Regex patterns for sensitive e-commerce data
        self.patterns = [
            (
                "credit_card",
                re.compile(r'\b(?:\d[ -]*?){13,19}\b'),
                "[REDACTED_CREDIT_CARD]"
            ),
            (
                "ssn",
                re.compile(r'\b\d{3}[- ]?\d{2}[- ]?\d{4}\b'),
                "[REDACTED_SSN]"
            ),
            (
                "cvv",
                re.compile(r'(?i)\b(?:cvv|cvc|security\s*code)[\s:=]+(\d{3,4})\b'),
                "[REDACTED_CVV]"
            ),
            (
                "password",
                re.compile(r'(?i)\b(?:password|passwd|secret)[\s:=]+([^\s,;]+)\b'),
                "[REDACTED_SECRET]"
            ),
            (
                "phone_number",
                re.compile(r'\b(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})\b'),
                "[REDACTED_PHONE]"
            )
        ]

    def redact(self, text: str) -> Tuple[str, int, List[str]]:
        if not text:
            return "", 0, []

        sanitized = text
        total_redactions = 0
        detected_types = set()

        for p_type, regex, replacement in self.patterns:
            matches = list(regex.finditer(sanitized))
            if matches:
                detected_types.add(p_type)
                total_redactions += len(matches)
                sanitized = regex.sub(replacement, sanitized)

        return sanitized, total_redactions, list(detected_types)

pii_service = PIIService()
