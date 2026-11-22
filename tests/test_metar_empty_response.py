from src.data_collection.weather_sources import WeatherDataCollector


class _EmptyResponse:
    status_code = 204
    content = b""

    def raise_for_status(self):
        return None

    def json(self):
        raise ValueError("empty body has no JSON")


def test_empty_metar_response_does_not_raise(monkeypatch):
    collector = WeatherDataCollector({})
    monkeypatch.setattr(collector, "_http_get", lambda *args, **kwargs: _EmptyResponse())
    assert not collector.fetch_metar("masroor air base")
