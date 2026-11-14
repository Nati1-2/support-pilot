import math
import re
from typing import List, Dict, Any, Optional
from backend.app.database import get_collection
from backend.app.models.ticket import PolicyCitation

class RAGService:
    STOP_WORDS = {
        "the", "and", "for", "that", "this", "with", "from", "your", "have", "are", "can", "will",
        "our", "you", "order", "orders", "where", "what", "when", "how", "why", "please", "really",
        "would", "could", "like", "want", "need", "just", "it's", "i'm", "been", "was", "not", "but",
        "all", "any", "get", "has", "had", "its", "they", "them", "there", "here", "about", "into",
        "customer", "store", "policy", "general", "support", "inquiry",
    }

    # Detected intent -> policy tag that should be preferred for grounding.
    INTENT_TAGS = {
        "shipping_delay": "shipping_delay",
        "address_change": "address_change",
        "return_rma": "returns",
        "store_credit": "store_credit",
        "vip_churn_risk": "vip",
        "payment_failed": "payment",
    }

    @staticmethod
    def _stem(token: str) -> str:
        for suffix in ("ing", "ed", "es", "s"):
            if len(token) > len(suffix) + 3 and token.endswith(suffix):
                return token[: -len(suffix)]
        return token

    def _tokenize(self, text: str) -> List[str]:
        if not text:
            return []
        tokens: List[str] = []
        for raw in re.findall(r"[a-z0-9_'-]{3,}", text.lower()):
            parts = [raw] + [p for p in re.split(r"[_-]", raw) if len(p) >= 3]
            for part in parts:
                part = part.strip("'")
                if len(part) >= 3 and part not in self.STOP_WORDS and not part.isdigit():
                    tokens.append(self._stem(part))
        return list(dict.fromkeys(tokens))

    def _calculate_score(self, query_tokens: List[str], doc_tokens: List[str], title_tokens: List[str], tags: List[str]) -> float:
        if not query_tokens or not doc_tokens:
            return 0.0

        doc_set = set(doc_tokens)
        title_set = set(title_tokens)
        tag_set = set(self._tokenize(" ".join(tags)))

        score = 0.0
        for token in query_tokens:
            if token in title_set:
                score += 3.0
            if token in tag_set:
                score += 2.5
            if token in doc_set:
                score += 1.0

        # Saturating normalization: long customer messages are not penalized
        # for words that simply do not appear in any policy.
        normalized = score / (score + 8.0)
        return min(round(normalized, 3), 0.99)

    def _extract_snippet(self, content: str, query_tokens: List[str], max_len: int = 240) -> str:
        paragraphs = [p.strip() for p in content.split('\n') if p.strip()]
        best_para = ""
        best_overlap = -1

        query_set = set(query_tokens)
        for p in paragraphs:
            p_tokens = set(self._tokenize(p))
            overlap = len(query_set.intersection(p_tokens))
            if overlap > best_overlap:
                best_overlap = overlap
                best_para = p

        if not best_para and paragraphs:
            best_para = paragraphs[0]

        if len(best_para) > max_len:
            return best_para[:max_len].rsplit(' ', 1)[0] + '...'
        return best_para

    async def search_policies(
        self, workspace_id: str, query: str, limit: int = 3, threshold: float = 0.3,
        intent: Optional[str] = None,
    ) -> List[PolicyCitation]:
        col = get_collection("policy_sections")
        cursor = col.find({"workspace_id": workspace_id, "is_active": True})
        sections = await cursor.to_list()

        query_tokens = self._tokenize(query)
        scored_sections = []

        for sec in sections:
            doc_tokens = self._tokenize(sec.get("content", ""))
            title_tokens = self._tokenize(sec.get("title", ""))
            tags = sec.get("tags", [])

            score = self._calculate_score(query_tokens, doc_tokens, title_tokens, tags)
            preferred_tag = self.INTENT_TAGS.get(intent or "")
            if preferred_tag and preferred_tag in tags:
                score = min(0.99, round(score + 0.35, 3))
            if score >= threshold:
                snippet = self._extract_snippet(sec.get("content", ""), query_tokens)
                scored_sections.append({
                    "section_id": str(sec.get("_id", sec.get("id"))),
                    "title": sec.get("title", "Store Policy"),
                    "score": score,
                    "snippet": snippet
                })

        # Sort by relevance
        scored_sections.sort(key=lambda x: x["score"], reverse=True)
        if not scored_sections and sections:
            # Only fall back to a policy that matches the intent or an explicit
            # topic word; an unrelated citation is worse than none.
            query_lower = query.lower()
            wanted_tag = self.INTENT_TAGS.get(intent or "")
            if not wanted_tag:
                for words, tag in (
                    (("return", "rma", "refund", "exchange"), "returns"),
                    (("delay", "late", "tracking", "where is"), "shipping_delay"),
                    (("address",), "address_change"),
                    (("credit", "compensation"), "store_credit"),
                    (("payment", "card declined"), "payment"),
                ):
                    if any(w in query_lower for w in words):
                        wanted_tag = tag
                        break
            fallback = next((s for s in sections if wanted_tag and wanted_tag in s.get("tags", [])), None)
            if fallback:
                scored_sections.append({
                    "section_id": str(fallback.get("_id", fallback.get("id"))),
                    "title": fallback.get("title", "Store Policy"),
                    "score": 0.3,
                    "snippet": self._extract_snippet(fallback.get("content", ""), query_tokens),
                })
        if scored_sections:
            best = scored_sections[0]["score"]
            scored_sections = [s for s in scored_sections if s["score"] >= best * 0.5]
        top = scored_sections[:limit]

        return [
            PolicyCitation(
                section_id=s["section_id"],
                title=s["title"],
                relevance_score=s["score"],
                snippet=s["snippet"]
            )
            for s in top
        ]

rag_service = RAGService()
