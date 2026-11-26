# KitabWanag

A neighborhood book exchange, sell, and buy marketplace with OpenStreetMap discovery for students and readers.

## Features

- **Exchange, Sell & Buy Flows**: Browse all listings, filter by listing type (`All`, `Exchange`, `Sell`, `Buy`), search by title/author/city, and send direct swap, purchase, or seller requests.
- **Interactive Nearby Map**: Powered by Leaflet and OpenStreetMap. Supports browser geolocation ("Books near me") with radius filtering as well as a city-picker fallback when location is denied.
- **Account & Ownership Controls**: Password hashing with `bcryptjs`, JWT authentication, rate-limited auth endpoints, and strict owner checks for editing, deleting, and accepting/declining requests.
- **Photo Uploads**: Validates JPEG, PNG, and WebP images via file magic bytes and supports Cloudinary when configured or local `/uploads` persistence out of the box.

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, React Router, Leaflet
- **Backend**: Node.js, Express, Mongoose (`2dsphere` GeoJSON index) with automatic local GeoJSON persistence fallback when `MONGO_URI` is unset
- **Security**: `bcryptjs`, `jsonwebtoken`, `express-rate-limit`, `multer`

## Local Setup

1. Copy `.env.example` to `.env` and optionally configure `MONGO_URI` and Cloudinary keys.
2. Install dependencies with `npm install`.
3. Run `npm run dev` to start the Express + Vite server on port `3000`.

## Engineering Notes

- **GeoJSON vs Leaflet Coordinates**: MongoDB `2dsphere` indexes require `[longitude, latitude]`, while Leaflet expects `[latitude, longitude]`. `src/lib/cities.ts` exposes `toLeafletLatLng()` to enforce a single conversion boundary.
