from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from app.core.config import get_settings


def tz() -> ZoneInfo:
    return ZoneInfo(get_settings().timezone)


def now_local() -> datetime:
    """Fecha-hora actual en la zona horaria configurada (America/La_Paz)."""
    return datetime.now(tz())


def today_local() -> date:
    return now_local().date()


def combine_local(d: date, t: time) -> datetime:
    return datetime.combine(d, t, tzinfo=tz())
