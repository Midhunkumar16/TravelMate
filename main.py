from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import httpx
import asyncio
import os
import random
from dotenv import load_dotenv
from math import radians, sin, cos, sqrt, atan2

load_dotenv()

app = FastAPI(title="Hotel Rate Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
PLACES_URL    = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
DETAILS_URL   = "https://maps.googleapis.com/maps/api/place/details/json"
TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"

MY_HOTEL_STORE      = {}
PINNED_COMPETITORS  = {}   # place_id -> hotel dict
ROOM_TYPES = ["single", "double", "twin", "suite", "family"]

EXCLUDED_KEYWORDS = [
    "airbnb", "basement", "bedroom", "townhouse", "apartment",
    "suite rental", "home", "house", "cottage", "condo", "room for rent",
    "retreat", "guest room"
]


# ── Models ────────────────────────────────────────────────────────────────────

class RoomRates(BaseModel):
    single: float
    double: float
    twin: float
    suite: float
    family: float


class MyHotel(BaseModel):
    name: str
    address: str
    lat: float
    lng: float
    star_rating: int
    room_rates: RoomRates


class PinRequest(BaseModel):
    place_id: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def is_real_hotel(place):
    name  = place.get("name", "").lower()
    types = set(place.get("types", []))
    if any(kw in name for kw in EXCLUDED_KEYWORDS):
        return False
    if place.get("user_ratings_total", 0) < 10:
        return False
    if "lodging" not in types and "hotel" not in types:
        return False
    return True


def estimate_base_price(price_level, rating: float = 3.0) -> int:
    if price_level is not None:
        return {0: 75, 1: 110, 2: 170, 3: 280, 4: 480}.get(int(price_level), 170)
    if rating >= 4.5: return 300
    elif rating >= 4.0: return 200
    elif rating >= 3.5: return 140
    elif rating >= 3.0: return 100
    return 80


def simulate_booking_room_rates(base_price: int, rating: float) -> dict:
    multipliers = {"single": 0.75, "double": 1.0, "twin": 1.0, "suite": 1.85, "family": 1.45}
    return {
        room: round(base_price * m * (1 + random.uniform(-0.08, 0.08)))
        for room, m in multipliers.items()
    }


def build_rate_comparison(comp_rates: dict, my_rates: dict) -> dict:
    comparison = {}
    for room in ROOM_TYPES:
        my_rate   = my_rates.get(room, 0)
        comp_rate = comp_rates.get(room, 0)
        diff      = comp_rate - my_rate
        comparison[room] = {
            "my_rate": my_rate,
            "competitor_rate": comp_rate,
            "diff": round(diff),
            # diff < 0 → competitor cheaper than us (bad)
            # diff > 0 → competitor more expensive (good)
            "status": "cheaper" if diff < 0 else "expensive" if diff > 0 else "same"
        }
    return comparison


def haversine(lat1, lng1, lat2, lng2) -> float:
    R = 6371
    d_lat = radians(lat2 - lat1)
    d_lng = radians(lng2 - lng1)
    a = sin(d_lat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lng/2)**2
    return round(R * 2 * atan2(sqrt(a), sqrt(1-a)), 2)


async def fetch_all_nearby(client, lat, lng, radius) -> list:
    all_results, params = [], {
        "location": f"{lat},{lng}", "radius": radius,
        "type": "lodging", "key": GOOGLE_API_KEY,
    }
    for _ in range(3):
        resp = await client.get(PLACES_URL, params=params)
        data = resp.json()
        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            break
        all_results.extend(data.get("results", []))
        token = data.get("next_page_token")
        if not token:
            break
        await asyncio.sleep(2)
        params = {"pagetoken": token, "key": GOOGLE_API_KEY}
    return all_results


async def enrich_place(client, place, ref_lat, ref_lng) -> dict:
    """Fetch details for a place and build the full hotel dict."""
    place_id = place.get("place_id")
    resp     = await client.get(DETAILS_URL, params={
        "place_id": place_id,
        "fields": "name,rating,user_ratings_total,price_level,geometry,formatted_address",
        "key": GOOGLE_API_KEY,
    })
    details  = resp.json().get("result", {})
    price_level = details.get("price_level") if details.get("price_level") is not None else place.get("price_level")
    rating      = details.get("rating") or place.get("rating") or 3.0
    base_price  = estimate_base_price(price_level, rating)
    hotel_lat   = place["geometry"]["location"]["lat"]
    hotel_lng   = place["geometry"]["location"]["lng"]

    return {
        "id":                  place_id,
        "name":                details.get("name", place.get("name")),
        "address":             details.get("formatted_address", ""),
        "rating":              rating,
        "user_ratings_total":  details.get("user_ratings_total", place.get("user_ratings_total", 0)),
        "price_level":         price_level,
        "estimated_price_usd": base_price,
        "room_rates":          simulate_booking_room_rates(base_price, rating),
        "rate_source":         "booking_mock",
        "distance_km":         haversine(ref_lat, ref_lng, hotel_lat, hotel_lng),
        "lat": hotel_lat, "lng": hotel_lng,
        "pinned": place_id in PINNED_COMPETITORS,
    }


def attach_comparison(hotels: list, my_hotel: dict) -> list:
    if not my_hotel:
        return hotels
    my_rates = my_hotel["room_rates"]
    for h in hotels:
        h["rate_comparison"] = build_rate_comparison(h["room_rates"], my_rates)
    return hotels


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/my-hotel")
async def save_my_hotel(hotel: MyHotel):
    MY_HOTEL_STORE["hotel"] = hotel.dict()
    return {"status": "saved", "hotel": MY_HOTEL_STORE["hotel"]}


@app.get("/my-hotel")
async def get_my_hotel():
    if "hotel" not in MY_HOTEL_STORE:
        raise HTTPException(status_code=404, detail="No hotel profile saved yet")
    return MY_HOTEL_STORE["hotel"]


@app.get("/search")
async def search_hotels(q: str = Query(..., description="Hotel name or location")):
    """Search for any hotel globally using Google Places Text Search."""
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not set")
    my_hotel = MY_HOTEL_STORE.get("hotel")
    ref_lat  = my_hotel["lat"]  if my_hotel else 0
    ref_lng  = my_hotel["lng"]  if my_hotel else 0

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(TEXT_SEARCH_URL, params={
            "query": f"{q} hotel",
            "type": "lodging",
            "key": GOOGLE_API_KEY,
        })
        data    = resp.json()
        results = data.get("results", [])[:8]

        # Enrich each result concurrently
        tasks   = [enrich_place(client, p, ref_lat, ref_lng) for p in results]
        hotels  = await asyncio.gather(*tasks)

    hotels = attach_comparison(list(hotels), my_hotel)
    return {"results": hotels, "count": len(hotels)}


@app.post("/pinned-competitors")
async def pin_competitor(req: PinRequest):
    """Pin a hotel as a manually added competitor."""
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not set")
    my_hotel = MY_HOTEL_STORE.get("hotel")
    ref_lat  = my_hotel["lat"] if my_hotel else 0
    ref_lng  = my_hotel["lng"] if my_hotel else 0

    async with httpx.AsyncClient(timeout=15) as client:
        resp    = await client.get(DETAILS_URL, params={
            "place_id": req.place_id,
            "fields": "name,rating,user_ratings_total,price_level,geometry,formatted_address,place_id",
            "key": GOOGLE_API_KEY,
        })
        result  = resp.json().get("result", {})
        if not result:
            raise HTTPException(status_code=404, detail="Hotel not found")

        place   = {
            "place_id": req.place_id,
            "name": result.get("name"),
            "geometry": result.get("geometry"),
            "rating": result.get("rating"),
            "user_ratings_total": result.get("user_ratings_total", 0),
            "price_level": result.get("price_level"),
            "types": ["lodging"],
        }
        hotel   = await enrich_place(client, place, ref_lat, ref_lng)

    hotel["pinned"] = True
    if my_hotel:
        hotel["rate_comparison"] = build_rate_comparison(hotel["room_rates"], my_hotel["room_rates"])

    PINNED_COMPETITORS[req.place_id] = hotel
    return {"status": "pinned", "hotel": hotel}


@app.delete("/pinned-competitors/{place_id}")
async def unpin_competitor(place_id: str):
    if place_id in PINNED_COMPETITORS:
        del PINNED_COMPETITORS[place_id]
        return {"status": "unpinned"}
    raise HTTPException(status_code=404, detail="Not found in pinned list")


@app.get("/pinned-competitors")
async def get_pinned_competitors():
    my_hotel = MY_HOTEL_STORE.get("hotel")
    pinned   = list(PINNED_COMPETITORS.values())
    pinned   = attach_comparison(pinned, my_hotel)
    return {"pinned": pinned, "count": len(pinned)}


@app.get("/competitors")
async def get_competitors(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: int = Query(5000),
):
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not set")
    my_hotel = MY_HOTEL_STORE.get("hotel")

    async with httpx.AsyncClient(timeout=30) as client:
        all_results = await fetch_all_nearby(client, lat, lng, radius)
        filtered    = [p for p in all_results if is_real_hotel(p)]
        seen, unique = set(), []
        for p in filtered:
            pid = p.get("place_id")
            if pid not in seen:
                seen.add(pid)
                unique.append(p)
        tasks       = [enrich_place(client, place, lat, lng) for place in unique]
        competitors = list(await asyncio.gather(*tasks))

    competitors = sorted(competitors, key=lambda h: h["distance_km"])
    competitors = attach_comparison(competitors, my_hotel)
    return {"my_hotel": my_hotel, "competitors": competitors, "count": len(competitors)}


@app.get("/hotels/nearby")
async def get_nearby_hotels(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: int = Query(5000),
):
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not set")
    async with httpx.AsyncClient(timeout=30) as client:
        all_results = await fetch_all_nearby(client, lat, lng, radius)
        filtered    = [p for p in all_results if is_real_hotel(p)]
        seen, unique = set(), []
        for p in filtered:
            pid = p.get("place_id")
            if pid not in seen:
                seen.add(pid)
                unique.append(p)
        tasks  = [enrich_place(client, place, lat, lng) for place in unique]
        hotels = list(await asyncio.gather(*tasks))
    hotels = sorted(hotels, key=lambda h: h["distance_km"])
    return {"hotels": hotels, "count": len(hotels)}


@app.get("/health")
async def health():
    return {"status": "ok", "api_key_set": bool(GOOGLE_API_KEY)}


# ── TravelMate Endpoints ──────────────────────────────────────────────────────

TRAVELMATE_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
TRAVELMATE_NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
TRAVELMATE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"


@app.get("/travelmate/hotel")
async def find_hotel(q: str = Query(..., description="Hotel name and city")):
    """Search for a hotel by name and return its location."""
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not set")
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(TRAVELMATE_SEARCH_URL, params={
            "query": q,
            "type": "lodging",
            "key": GOOGLE_API_KEY,
        })
        results = resp.json().get("results", [])
        if not results:
            raise HTTPException(status_code=404, detail="Hotel not found")
        h = results[0]
        return {
            "place_id": h.get("place_id"),
            "name": h.get("name"),
            "address": h.get("formatted_address", ""),
            "lat": h["geometry"]["location"]["lat"],
            "lng": h["geometry"]["location"]["lng"],
            "rating": h.get("rating"),
        }


@app.get("/travelmate/places")
async def get_places_near_hotel(
    lat: float = Query(...),
    lng: float = Query(...),
    category: str = Query(..., description="e.g. restaurant, museum, bar, shopping_mall, park"),
    radius: int = Query(1500),
    keyword: str = Query(None, description="Optional keyword filter e.g. 'rooftop', 'vegan'"),
):
    """Fetch places of a given category near a hotel location."""
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not set")

    params = {
        "location": f"{lat},{lng}",
        "radius": radius,
        "type": category,
        "key": GOOGLE_API_KEY,
    }
    if keyword:
        params["keyword"] = keyword

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(TRAVELMATE_NEARBY_URL, params=params)
        results = resp.json().get("results", [])[:8]

    places = []
    for p in results:
        plat = p["geometry"]["location"]["lat"]
        plng = p["geometry"]["location"]["lng"]
        places.append({
            "id": p.get("place_id"),
            "name": p.get("name"),
            "address": p.get("vicinity", ""),
            "rating": p.get("rating"),
            "user_ratings_total": p.get("user_ratings_total", 0),
            "price_level": p.get("price_level"),
            "open_now": p.get("opening_hours", {}).get("open_now"),
            "distance_km": haversine(lat, lng, plat, plng),
            "lat": plat,
            "lng": plng,
            "maps_url": f"https://www.google.com/maps/place/?q=place_id:{p.get('place_id')}",
        })

    places.sort(key=lambda x: x["distance_km"])
    return {"places": places, "count": len(places)}
