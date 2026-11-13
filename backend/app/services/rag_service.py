import math
import re
from typing import List, Dict, Any, Optional
from backend.app.database import get_collection
from backend.app.models.ticket import PolicyCitation

class RAGService:
    def _tokenize(self, text: str) -> List[str]:
        if not text:
            return []
        text = text.lower()
        tokens = re.findall(r'\b[a-z0-9_-]{3,}\b', text)
        stop_words = {"the", "and", "for", "that", "this", "with", "from", "your", "have", "are", "can", "will", "our", "you"}
        return [t for t in tokens if t not in stop_words]

    def _calculate_score(self, query_tokens: List[str], doc_tokens: List[str], title_tokens: List[str], tags: List[str]) -> float:
        if not query_tokens or not doc_tokens:
            return 0.0

        # Word frequency in doc
        doc_set = set(doc_tokens)
        title_set = set(title_tokens)
        tag_set = set([t.lower() for t in tags])

        score = 0.0
        for token in query_tokens:
            if token in title_set:
                score += 3.0
            if token in tag_set:
                score += 2.5
            if token in doc_set:
                score += 1.0

        # Normalize score
        normalized = score / (len(query_tokens) * 3.0 + 1e-5)
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

    async def search_policies(self, workspace_id: str, query: str, limit: int = 3, threshold: float = 0.15) -> List[PolicyCitation]:
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
            query_lower = query.lower()
            category = "general"
            if any(word in query_lower for word in ("return", "rma", "refund", "exchange")):
                category = "returns"
            elif any(word in query_lower for word in ("credit", "compensation", "payment")):
                category = "store_credit"
            elif any(word in query_lower for word in ("vip", "churn", "escalat")):
                category = "escalations"
            elif any(word in query_lower for word in ("ship", "delay", "address", "tracking", "deliver")):
                category = "shipping"

            fallback = next((s for s in sections if s.get("category") == category), sections[0])
            scored_sections.append({
                "section_id": str(fallback.get("_id", fallback.get("id"))),
                "title": fallback.get("title", "Store Policy"),
                "score": 0.1,
                "snippet": self._extract_snippet(fallback.get("content", ""), query_tokens),
            })
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
