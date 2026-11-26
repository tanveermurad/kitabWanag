import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toLeafletLatLng } from '../lib/cities';
import type { BookListing } from '../types';

interface LeafletMapProps {
  books: BookListing[];
  /** Center as [longitude, latitude] */
  center?: [number, number];
  zoom?: number;
  userCircleKm?: number;
  heightClassName?: string;
  interactivePicker?: boolean;
  pickedCoords?: [number, number];
  onPickCoords?: (coords: [number, number]) => void;
}

function createPinIcon(type: string, isPicked = false): L.DivIcon {
  const fill = isPicked
    ? '#B45309'
    : type === 'Sell'
      ? '#1B4D3E'
      : type === 'Exchange'
        ? '#2B6E59'
        : '#3E4C46';

  return L.divIcon({
    className: 'kitab-pin-wrapper',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -34],
    html: `<svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 1C6.82 1 1 6.82 1 14C1 23.25 14 35 14 35C14 35 27 23.25 27 14C27 6.82 21.18 1 14 1Z" fill="${fill}" stroke="#FAF7F2" stroke-width="2"/>
      <circle cx="14" cy="14" r="4.5" fill="#FAF7F2"/>
    </svg>`,
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function LeafletMap({
  books,
  center = [66.9964, 30.1798],
  zoom = 6,
  userCircleKm,
  heightClassName = 'h-[480px]',
  interactivePicker = false,
  pickedCoords,
  onPickCoords,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const navigate = useNavigate();

  // Initialize Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: toLeafletLatLng(center),
      zoom,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = group;

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update center & zoom smoothly when center prop changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setView(toLeafletLatLng(center), zoom, { animate: true });
  }, [center, zoom]);

  // Handle interactive map click when picking a book location
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !interactivePicker || !onPickCoords) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      // Convert Leaflet [lat, lng] back to GeoJSON [lng, lat]
      const lng = Number(e.latlng.lng.toFixed(6));
      const lat = Number(e.latlng.lat.toFixed(6));
      onPickCoords([lng, lat]);
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [interactivePicker, onPickCoords]);

  // Sync markers and optional search radius circle
  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    if (userCircleKm && userCircleKm > 0) {
      L.circle(toLeafletLatLng(center), {
        radius: userCircleKm * 1000,
        color: '#1B4D3E',
        weight: 1.5,
        fillColor: '#1B4D3E',
        fillOpacity: 0.08,
      }).addTo(group);
    }

    if (interactivePicker && pickedCoords) {
      L.marker(toLeafletLatLng(pickedCoords), {
        icon: createPinIcon('Picked', true),
      })
        .bindPopup('<div style="font-size:13px;font-weight:600;">Selected book pickup location</div>')
        .addTo(group);
    }

    books.forEach((book) => {
      const latLng = toLeafletLatLng(book.location.coordinates);
      const marker = L.marker(latLng, { icon: createPinIcon(book.listingType) });

      const priceLabel =
        book.listingType === 'Sell'
          ? `${book.price.toLocaleString()} ${book.currency}`
          : book.listingType === 'Exchange'
            ? 'Open to swap'
            : 'Wanted copy';

      const popupEl = document.createElement('div');
      popupEl.style.minWidth = '190px';
      popupEl.innerHTML = `
        <div style="font-size:11px;font-weight:600;color:#1B4D3E;margin-bottom:4px;">
          ${escapeHtml(book.listingType)} · ${escapeHtml(book.city)}
        </div>
        <div style="font-family:'Playfair Display',Georgia,serif;font-size:15px;font-weight:600;color:#1C1F1D;margin-bottom:2px;">
          ${escapeHtml(book.title)}
        </div>
        <div style="font-size:12px;color:#5C615D;margin-bottom:8px;">
          ${escapeHtml(book.author)} · ${escapeHtml(priceLabel)}
        </div>
      `;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'View Book';
      btn.style.cssText =
        'display:inline-block;padding:6px 12px;border-radius:6px;background:#1B4D3E;color:#FAF7F2;font-size:12px;font-weight:600;border:none;cursor:pointer;';
      btn.addEventListener('click', () => {
        navigate(`/books/${book.id}`);
      });
      popupEl.appendChild(btn);

      marker.bindPopup(popupEl).addTo(group);
    });
  }, [books, center, userCircleKm, interactivePicker, pickedCoords, navigate]);

  return (
    <div
      ref={containerRef}
      className={`w-full ${heightClassName} rounded-xl border border-[#E5DFD3] overflow-hidden z-0`}
      aria-label="Interactive OpenStreetMap book map"
    />
  );
}
