# Environmental ambience sources

The environmental ambience is generated at runtime with the Web Audio API. It does not load recorded audio or third-party samples.

- Wind and waves use filtered, periodic additive-noise buffers whose frequencies complete whole cycles at the loop boundary.
- Fountain water uses the same procedural buffer through a separate filter and gain stage.
- City machinery uses a low sine layer. A separate ferry-motor oscillator is driven by an envelope sampled from the same route and dwell timing as the visible water taxi, so it fades to silence at both docks.
- Distant gull calls use a short synthesized frequency envelope with intervals of roughly 28–45 seconds.

The soundtrack player remains a separate control with its own source and license credits.
