"""
텔레그램 뉴스 발송 서비스

하루 3회 (KST 07:00 / 12:00 / 18:00) 글로벌 투자 뉴스 5개를 텔레그램 채널로 전송.
TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID 환경변수 필요.
"""
import os
import logging
import requests

logger = logging.getLogger(__name__)

TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"

SLOT_LABELS = {
    7:  "오전 시황",
    12: "점심 시황",
    18: "저녁 시황",
}


def _build_message(news_items: list[dict], slot_hour: int) -> str:
    label = SLOT_LABELS.get(slot_hour, "시황")
    lines = []
    for i, item in enumerate(news_items[:5], 1):
        title = item.get("title", "").strip()
        url = item.get("url", "").strip()
        source = item.get("source", "").strip()
        source_tag = f" ({source})" if source else ""
        lines.append(f"{i}. {title}{source_tag}")
        if url:
            lines.append(f"   {url}")
    lines.append(f"\nWhalyx {label}")
    lines.append("https://whalyx.vercel.app")
    return "\n".join(lines)


def send_news_to_telegram(slot_hour: int) -> bool:
    """
    텔레그램으로 뉴스 5개 발송.
    slot_hour: KST 기준 시간 (7, 12, 18)
    """
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        logger.warning("[telegram] TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID 미설정 — 발송 건너뜀")
        return False

    from backend.services.news import fetch_top_headlines
    headlines = fetch_top_headlines(20)
    if not headlines:
        logger.warning("[telegram] 뉴스 수집 실패 — 발송 건너뜀")
        return False

    message = _build_message(headlines, slot_hour)
    url = TELEGRAM_API.format(token=token)
    try:
        resp = requests.post(
            url,
            json={"chat_id": chat_id, "text": message, "disable_web_page_preview": True},
            timeout=10,
        )
        if resp.status_code == 200:
            logger.info(f"[telegram] {slot_hour}시 뉴스 발송 완료")
            return True
        else:
            logger.error(f"[telegram] 발송 실패: {resp.status_code} {resp.text}")
            return False
    except Exception as e:
        logger.error(f"[telegram] 발송 오류: {e}")
        return False
