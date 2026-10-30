import time

from src.data_collection.weather_sources import WeatherDataCollector


class _Stop(Exception):
    pass


def _collector(monkeypatch, url):
    monkeypatch.setenv("OPEN_METEO_FORECAST_URL", url)
    collector = WeatherDataCollector({})
    collector._open_meteo_min_interval_sec = 0
    seen = []

    def fake_get(called_url, **kwargs):
        seen.append(called_url)
        raise _Stop()

    monkeypatch.setattr(collector, "_http_get", fake_get)
    return collector, seen


def test_forecast_uses_configured_url(monkeypatch):
    collector, seen = _collector(monkeypatch, "https://om.example/v1/forecast")
    try:
        collector.fetch_from_open_meteo(48.2, 16.37)
    except _Stop:
        pass
    assert seen == ["https://om.example/v1/forecast"]


def test_forecast_url_defaults_to_public_api(monkeypatch):
    monkeypatch.delenv("OPEN_METEO_FORECAST_URL", raising=False)
    assert WeatherDataCollector({}).open_meteo_forecast_url == "https://api.open-meteo.com/v1/forecast"


def test_ensemble_cooldown_does_not_block_forecast(monkeypatch):
    collector, seen = _collector(monkeypatch, "https://om.example/v1/forecast")
    collector._open_meteo_ensemble_rate_limit_until = time.time() + 900
    try:
        collector.fetch_from_open_meteo(48.2, 16.37)
    except _Stop:
        pass
    assert seen, "forecast must still be requested while only the ensemble is cooling down"
