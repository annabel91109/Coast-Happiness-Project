import { TileLayer } from "react-leaflet";
import { useLang } from "../LangContext";

// In Hong Kong, OSM stores Chinese in the primary `name` tag and English
// in `name:en`, so the standard OSM raster tiles render 中環/沙田 etc. —
// what we want for Traditional Chinese mode. CARTO Voyager renders
// `name:en` and gives clean English labels for the EN mode.
const TILE_VARIANTS = {
  en: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  },
  tc: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: "abc",
    maxZoom: 19,
  },
};

export default function LangAwareTileLayer() {
  const { lang } = useLang();
  const v = TILE_VARIANTS[lang] || TILE_VARIANTS.en;
  // The `key` forces Leaflet to remount the tile layer on lang change
  // — without it the tile URL change is ignored mid-session.
  return (
    <TileLayer
      key={lang}
      url={v.url}
      attribution={v.attribution}
      subdomains={v.subdomains}
      maxZoom={v.maxZoom}
    />
  );
}
