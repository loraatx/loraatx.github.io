# MAP APP DEPLOYMENT SPEC
# ──────────────────────────────────────────────────────────────
# INSTRUCTIONS FOR CLAUDE SONNET:
#   Read CLAUDE.md in this folder for step-by-step deployment
#   instructions. Every value below maps directly to a CONFIG key.
#   DO NOT modify app.js or style.css — they are frozen.
#   Only edit: config.js, index.html (title tag), data.geojson
# ──────────────────────────────────────────────────────────────

## DEPLOYMENT
folder_name:       my-new-map
# The app will be live at anatomy.city/apps/<folder_name>/


## IDENTITY
title:             My Map Title
eyebrow:           Austin Metro
subtitle:          
# subtitle appears below the title (leave blank if unused)

info_panel_text:   Write a short paragraph describing this map here.
# Shown when the user clicks the ⓘ info button in the toolbar.


## MAP SETTINGS
center_lat:        30.267
center_lng:        -97.743
zoom:              12
pitch:             45
bearing:           -15
marker_color:      "#6b3a2a"
# marker_color: any CSS hex color, e.g. "#1a73e8"


## BOUNDS LOCK
# Set bounds_enabled to true to prevent users from panning outside a defined area.
# Useful for neighborhood-scale maps (e.g. Rainey Street bars, SoCo shops).
# Leave false for city-wide or unrestricted maps.
bounds_enabled:    false
bounds_sw_lat:     30.250
bounds_sw_lng:     -97.745
bounds_ne_lat:     30.265
bounds_ne_lng:     -97.732
# Tip: Open Google Maps, zoom to your area, read lat/lng from the URL.
# Add ~0.005 padding on each side to avoid clipping markers at the edge.
# NOTE: longitude comes FIRST in the config array — Sonnet handles this conversion.


## DATA SCHEMA
name_field:        name
# Which GeoJSON property holds the display name for each location.
# Used as the popup title and in Reddit search URLs.

# Document your GeoJSON properties below so filters/columns/popup can be configured:
# property         | type    | example values
# name             | string  | "My Place"
# type             | string  | "Bar", "Coffee Shop"
# address          | string  | "123 Main St"
# website          | url     | "https://example.com"
# phone            | string  | "(512) 555-1234"
# instagram        | string  | "myhandle"  (no @, link auto-generated)
# inspection_score | number  | 95  (renders as colored badge)
# inspection_date  | string  | "2024-01-15"


## FILTERS
# Dropdowns shown above the table. Values are auto-populated from data.
# Leave property blank to disable that filter slot.
filter_1_property: type
filter_1_label:    Type

filter_2_property: 
filter_2_label:    

filter_3_property: 
filter_3_label:    


## TABLE COLUMNS
# Columns displayed in the results table (left → right).
# Format: property | Header Label
# Use "instagram" property for auto-linked @handle display.
# Use any "http..." string property for auto-linked URL display.
column_1:  name      | Name
column_2:  type      | Type
column_3:  address   | Address
column_4:  website   | Website
column_5:  
column_6:  


## POPUP FIELDS
# Fields shown in the info popup when a marker is clicked.
# Format: property | Label
# Special handling: "instagram" → @handle link, "inspection_score" → badge
popup_1:   type      | Type
popup_2:   address   | Address
popup_3:   website   | Website
popup_4:   phone     | Phone
popup_5:   
popup_6:   


## OVERLAY LAYERS
# GeoJSON polygon layers toggled via the "Layers" button on the map.
# colorProperty: the property used to color-code polygons by value.
# Leave label blank to disable that overlay slot.
# Add more entries as needed — no limit.
overlay_1_label:            Zip Codes
overlay_1_file:             ../shared/SecondData.geojson
overlay_1_color_property:   zipcode

overlay_2_label:            
overlay_2_file:             
overlay_2_color_property:   

overlay_3_label:            
overlay_3_file:             
overlay_3_color_property:   


## SOCIAL LINKS
# Icons appear in the page footer. Leave url blank to hide that icon.
youtube:    
x:          
facebook:   
instagram:  
reddit:     
patreon:    
discord:    


## FEATURE FLAGS
# Set any to false to hide that button/section entirely.
draw_tools:      true
measure:         true
export_png:      true
export_csv:      true
report_pdf:      true
street_view:     true
satellite:       true
topo:            true
dark_mode:       true
geolocation:     true


## GOOGLE MAPS API KEY
# Required for the Street View popup tab. Leave blank to show a fallback link.
# Get a key at https://console.cloud.google.com/ (enable Maps Embed API)
google_maps_api_key:   


## REDDIT CITY SUFFIX
# Appended to every Reddit search — e.g. "Epoch Coffee Austin"
# Set to empty string to search by name only.
reddit_city:           Austin


## DATA
# Provide the path to your GeoJSON file (relative to the repo root),
# OR paste raw GeoJSON below the data_geojson key.

# Option A — file path:
data_file:    /path/to/your/data.geojson

# Option B — paste inline GeoJSON:
# data_geojson: |
#   {
#     "type": "FeatureCollection",
#     "features": [
#       {
#         "type": "Feature",
#         "geometry": { "type": "Point", "coordinates": [-97.743, 30.267] },
#         "properties": { "name": "Example Place", "type": "Bar" }
#       }
#     ]
#   }
