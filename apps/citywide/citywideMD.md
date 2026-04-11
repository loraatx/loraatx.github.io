# Citywide Deployment Spec

> **Template:** `apps/citywide/` -- Metro-scale map (zoom 9-12, city/region bounds)
> **To deploy:** Fill out every field below, provide `data.geojson`, and give this file to Claude.

## Deploy
folder_name:
template: citywide

## Identity
title:
eyebrow:
subtitle:
info_panel_text:

## Map Defaults
center_lat: 30.267
center_lng: -97.743
zoom: 10
pitch: 45
bearing: -15
marker_color: #2d7a1a

## Bounds (Greater Austin metro area default)
bounds_sw_lat: 29.97
bounds_sw_lng: -98.04
bounds_ne_lat: 30.62
bounds_ne_lng: -97.47

## Data Fields
name_field:
reddit_city: Austin
google_maps_api_key:

## Filters (leave blank lines to skip)
filter_1: Property | Label
filter_2: Property | Label
filter_3: Property | Label
filter_4:
filter_5:

## Table Columns (leave blank lines to skip)
column_1: Property | Header
column_2: Property | Header
column_3: Property | Header
column_4: Property | Header
column_5:
column_6:
column_7:
column_8:

## Popup Fields (leave blank lines to skip)
popup_1: Property | Label
popup_2: Property | Label
popup_3: Property | Label
popup_4: Property | Label
popup_5:
popup_6:
popup_7:
popup_8:

## Overlay Layers (leave blank lines to skip)
overlay_1_label: Zip Codes
overlay_1_file: ../shared/SecondData.geojson
overlay_1_color_property: zipcode
overlay_2_label: Flood Zone
overlay_2_file: ../shared/floodzone.geojson
overlay_2_color_property: flood_zone
overlay_3_label: City Council
overlay_3_file: ../shared/Council_Districts.geojson
overlay_3_color_property: district_name
overlay_4_label:
overlay_4_file:
overlay_4_color_property:
overlay_5_label:
overlay_5_file:
overlay_5_color_property:

## UI Elements & Feature Flags (Yes / No)

### Header Bar
- Header Title Bar: Yes
- Info Panel (i button): Yes
- 2D/3D View Toggle: Yes
- Dark Mode Toggle: Yes

### Map Controls
- Satellite Imagery Toggle: Yes
- Topo Overlay Toggle (USGS raster + terrain bump): Yes
- Buildings Toggle: Yes
- Geolocation Button: Yes
- Layers Panel (polygon overlays): Yes

### Toolbar (Draw Bar)
- Draw Tool (freehand line): Yes
- Clear Drawing Button: Yes
- Measure Tool (distance in miles): Yes
- Export Map PNG Button: Yes
- Report PDF Button: Yes

### Table & Data
- Filter Dropdowns: Yes
- Data Table: Yes
- Export CSV Button: Yes
- Result Count: Yes

### Popups
- Info Tab (field detail rows): Yes
- Second Tab (placeholder): Yes
- Google Maps Nav Button: Yes
- Apple Maps Nav Button: Yes
- Waze Nav Button: Yes
- Reddit Search Button: Yes
- Street View Embed: Yes

### Footer
- Social Links Bar: Yes

## Social Links (leave blank to hide icon)
youtube:
x:
facebook:
instagram:
reddit:
patreon:
discord:

## Notes
