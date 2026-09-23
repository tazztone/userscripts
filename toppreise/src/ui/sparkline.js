/**
 * Interactive SVG Sparkline Component
 * Generates lightweight inline SVG sparkline polyline charts from product price history
 * with color-coded trend indicators and interactive tooltips.
 */

import { parsePrice } from '../domain/price.js';

export function renderSparkline(timeSeries, width = 60, height = 18) {
  if (!timeSeries || !Array.isArray(timeSeries) || timeSeries.length < 2) return null;
  const prices = timeSeries.map(p => {
    if (Array.isArray(p)) return typeof p[1] === 'number' ? p[1] : parsePrice(String(p[1]));
    if (typeof p === 'number') return p;
    if (p && typeof p.price === 'number') return p.price;
    if (p && p.price) return parsePrice(String(p.price));
    if (p && p.y) return typeof p.y === 'number' ? p.y : parsePrice(String(p.y));
    return 0;
  }).filter(p => p > 0);

  if (prices.length < 2) return null;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const padding = 2;
  const usableHeight = height - padding * 2;

  const points = prices.map((p, i) => {
    const x = ((i / (prices.length - 1)) * width).toFixed(1);
    const y = (height - padding - ((p - min) / range) * usableHeight).toFixed(1);
    return `${x},${y}`;
  }).join(' ');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.classList.add('tp-sparkline');

  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  const isTrendingDown = lastPrice <= firstPrice;
  const strokeColor = isTrendingDown ? '#10b981' : '#ef4444';

  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('points', points);
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', strokeColor);
  polyline.setAttribute('stroke-width', '1.5');
  polyline.setAttribute('stroke-linecap', 'round');
  polyline.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(polyline);

  svg.setAttribute('title', `Preisverlauf: CHF ${firstPrice.toFixed(2)} → CHF ${lastPrice.toFixed(2)} (Min: ${min.toFixed(2)}, Max: ${max.toFixed(2)})`);

  return svg;
}

