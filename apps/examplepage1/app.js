const map = new maplibregl.Map({
  container: 'map',
  style: 'https://demotiles.maplibre.org/style.json',
  center: [-97.7431, 30.2672], // Austin
  zoom: 12
});

map.addControl(new maplibregl.NavigationControl());

map.on('load', async () => {
  const response = await fetch('./data.geojson');
  const geojson = await response.json();

  map.addSource('points', {
    type: 'geojson',
    data: geojson
  });

  map.addLayer({
    id: 'points-layer',
    type: 'circle',
    source: 'points',
    paint: {
      'circle-radius': 6,
      'circle-color': '#007cbf'
    }
  });

  // Popup on click
  map.on('click', 'points-layer', (e) => {
    const coordinates = e.features[0].geometry.coordinates.slice();
    const properties = e.features[0].properties;

    new maplibregl.Popup()
      .setLngLat(coordinates)
      .setHTML(`
        <strong>${properties.name}</strong><br/>
        ${properties.description}
      `)
      .addTo(map);
  });

  // Change cursor on hover
  map.on('mouseenter', 'points-layer', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', 'points-layer', () => {
    map.getCanvas().style.cursor = '';
  });
});
