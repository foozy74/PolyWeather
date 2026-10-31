from src.data_collection.weather_sources import WeatherDataCollector


class _Resp:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


_PAYLOAD = {
    "daily": {
        "time": ["2026-10-31"],
        **{f"temperature_2m_max_member{i:02d}": [10.0 + i * 0.1] for i in range(1, 6)},
    }
}


def _collector(monkeypatch, models=None):
    if models is None:
        monkeypatch.delenv("OPEN_METEO_ENSEMBLE_MODELS", raising=False)
    else:
        monkeypatch.setenv("OPEN_METEO_ENSEMBLE_MODELS", models)
    collector = WeatherDataCollector({})
    collector._open_meteo_min_interval_sec = 0
    # Isolate from the on-disk Open-Meteo cache of the local database.
    monkeypatch.setattr(collector, "_maybe_reload_open_meteo_disk_cache", lambda: None)
    collector._ensemble_cache.clear()
    calls = []

    def fake_get(url, **kwargs):
        calls.append(kwargs.get("params", {}))
        return _Resp(_PAYLOAD)

    monkeypatch.setattr(collector, "_http_get", fake_get)
    return collector, calls


def test_ensemble_sends_default_model(monkeypatch):
    # Open-Meteo rejects ensemble requests without models ("best_match" unsupported).
    collector, calls = _collector(monkeypatch)
    result = collector.fetch_ensemble(48.2, 16.37)
    assert calls[0]["models"] == "icon_seamless"
    assert result and result["members"] == 5


def test_ensemble_model_is_configurable(monkeypatch):
    collector, calls = _collector(monkeypatch, "ecmwf_ifs025")
    collector.fetch_ensemble(48.2, 16.37)
    assert calls[0]["models"] == "ecmwf_ifs025"


def test_ensemble_url_is_configurable(monkeypatch):
    monkeypatch.setenv("OPEN_METEO_ENSEMBLE_URL", "https://ens.example/v1/ensemble")
    collector, _ = _collector(monkeypatch, "ecmwf_ifs025")
    seen = []
    monkeypatch.setattr(collector, "_http_get", lambda url, **kw: seen.append(url) or _Resp(_PAYLOAD))
    collector.fetch_ensemble(48.2, 16.37)
    assert seen == ["https://ens.example/v1/ensemble"]
