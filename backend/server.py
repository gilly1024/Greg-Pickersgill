from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import base64
from openai import OpenAI
import math

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# OpenAI client for AI analysis
openai_client = OpenAI(
    api_key=os.environ.get('EMERGENT_LLM_KEY'),
    base_url="https://api.emergentmethods.ai/v1"
)

# Create the main app
app = FastAPI(title="Paranormal Investigation API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Paranormal Categories
PARANORMAL_CATEGORIES = [
    "Ghost/Spirit",
    "UFO/UAP",
    "Cryptid",
    "Poltergeist",
    "Shadow Figure",
    "Orb",
    "EVP/Audio",
    "Unexplained Phenomenon",
    "Other"
]

# Models
class Location(BaseModel):
    latitude: float
    longitude: float
    address: Optional[str] = None

class Rating(BaseModel):
    user_id: str
    score: int  # 1-5 credibility score
    comment: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AIAnalysis(BaseModel):
    credibility_score: int  # 1-100
    analysis_summary: str
    similar_cases: List[str]
    suggested_investigation_steps: List[str]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Sighting(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    category: str
    location: Location
    date_occurred: datetime
    evidence_photos: List[str] = []  # Base64 encoded images
    witness_count: int = 1
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ratings: List[Rating] = []
    ai_analysis: Optional[AIAnalysis] = None
    verified: bool = False
    reporter_name: Optional[str] = None
    reporter_email: Optional[str] = None

class SightingCreate(BaseModel):
    title: str
    description: str
    category: str
    location: Location
    date_occurred: datetime
    witness_count: int = 1
    reporter_name: Optional[str] = None
    reporter_email: Optional[str] = None
    evidence_photos: List[str] = []

class SightingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    witness_count: Optional[int] = None

class RatingCreate(BaseModel):
    user_id: str
    score: int
    comment: Optional[str] = None

class NearbyQuery(BaseModel):
    latitude: float
    longitude: float
    radius_km: float = 50.0

# Helper functions
def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the distance between two points on Earth in km."""
    R = 6371  # Earth's radius in km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

async def perform_ai_analysis(sighting: Sighting) -> AIAnalysis:
    """Use AI to analyze the sighting."""
    try:
        prompt = f"""Analyze this paranormal sighting report and provide a structured assessment:

Title: {sighting.title}
Category: {sighting.category}
Description: {sighting.description}
Location: {sighting.location.address or f"Lat: {sighting.location.latitude}, Lon: {sighting.location.longitude}"}
Witness Count: {sighting.witness_count}
Date: {sighting.date_occurred}

Provide:
1. A credibility score from 1-100 based on the detail, consistency, and plausibility of the report
2. A brief analysis summary (2-3 sentences)
3. 2-3 similar historical cases or patterns
4. 3-4 suggested investigation steps

Format your response as:
CREDIBILITY: [score]
SUMMARY: [summary]
SIMILAR CASES: [case1] | [case2] | [case3]
INVESTIGATION STEPS: [step1] | [step2] | [step3] | [step4]"""

        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
            temperature=0.7
        )
        
        result = response.choices[0].message.content
        
        # Parse the response
        lines = result.strip().split('\n')
        credibility = 50
        summary = "Analysis pending."
        similar_cases = []
        investigation_steps = []
        
        for line in lines:
            if line.startswith('CREDIBILITY:'):
                try:
                    credibility = int(line.replace('CREDIBILITY:', '').strip())
                except:
                    credibility = 50
            elif line.startswith('SUMMARY:'):
                summary = line.replace('SUMMARY:', '').strip()
            elif line.startswith('SIMILAR CASES:'):
                similar_cases = [c.strip() for c in line.replace('SIMILAR CASES:', '').split('|')]
            elif line.startswith('INVESTIGATION STEPS:'):
                investigation_steps = [s.strip() for s in line.replace('INVESTIGATION STEPS:', '').split('|')]
        
        return AIAnalysis(
            credibility_score=credibility,
            analysis_summary=summary,
            similar_cases=similar_cases[:3],
            suggested_investigation_steps=investigation_steps[:4]
        )
    except Exception as e:
        logger.error(f"AI analysis failed: {e}")
        return AIAnalysis(
            credibility_score=50,
            analysis_summary="AI analysis unavailable. Manual review recommended.",
            similar_cases=["Unable to fetch similar cases"],
            suggested_investigation_steps=["Document all evidence", "Interview witnesses", "Research location history"]
        )

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Paranormal Investigation API", "version": "1.0.0"}

@api_router.get("/categories")
async def get_categories():
    return {"categories": PARANORMAL_CATEGORIES}

@api_router.post("/sightings", response_model=Sighting)
async def create_sighting(sighting_data: SightingCreate):
    """Create a new paranormal sighting report."""
    if sighting_data.category not in PARANORMAL_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category")
    
    sighting = Sighting(**sighting_data.model_dump())
    
    # Perform AI analysis
    sighting.ai_analysis = await perform_ai_analysis(sighting)
    
    # Save to database
    doc = sighting.model_dump()
    doc['date_occurred'] = doc['date_occurred'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    if doc['ai_analysis']:
        doc['ai_analysis']['timestamp'] = doc['ai_analysis']['timestamp'].isoformat()
    
    await db.sightings.insert_one(doc)
    return sighting

@api_router.get("/sightings", response_model=List[Sighting])
async def get_sightings(
    category: Optional[str] = None,
    verified: Optional[bool] = None,
    limit: int = 100,
    skip: int = 0
):
    """Get all sightings with optional filters."""
    query = {}
    if category:
        query['category'] = category
    if verified is not None:
        query['verified'] = verified
    
    cursor = db.sightings.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1)
    sightings = await cursor.to_list(limit)
    
    # Convert ISO strings back to datetime
    for s in sightings:
        if isinstance(s.get('date_occurred'), str):
            s['date_occurred'] = datetime.fromisoformat(s['date_occurred'])
        if isinstance(s.get('created_at'), str):
            s['created_at'] = datetime.fromisoformat(s['created_at'])
        if isinstance(s.get('updated_at'), str):
            s['updated_at'] = datetime.fromisoformat(s['updated_at'])
        if s.get('ai_analysis') and isinstance(s['ai_analysis'].get('timestamp'), str):
            s['ai_analysis']['timestamp'] = datetime.fromisoformat(s['ai_analysis']['timestamp'])
        for rating in s.get('ratings', []):
            if isinstance(rating.get('timestamp'), str):
                rating['timestamp'] = datetime.fromisoformat(rating['timestamp'])
    
    return sightings

@api_router.get("/sightings/{sighting_id}", response_model=Sighting)
async def get_sighting(sighting_id: str):
    """Get a specific sighting by ID."""
    sighting = await db.sightings.find_one({"id": sighting_id}, {"_id": 0})
    if not sighting:
        raise HTTPException(status_code=404, detail="Sighting not found")
    
    # Convert ISO strings
    if isinstance(sighting.get('date_occurred'), str):
        sighting['date_occurred'] = datetime.fromisoformat(sighting['date_occurred'])
    if isinstance(sighting.get('created_at'), str):
        sighting['created_at'] = datetime.fromisoformat(sighting['created_at'])
    if isinstance(sighting.get('updated_at'), str):
        sighting['updated_at'] = datetime.fromisoformat(sighting['updated_at'])
    if sighting.get('ai_analysis') and isinstance(sighting['ai_analysis'].get('timestamp'), str):
        sighting['ai_analysis']['timestamp'] = datetime.fromisoformat(sighting['ai_analysis']['timestamp'])
    
    return sighting

@api_router.post("/sightings/{sighting_id}/rate", response_model=Sighting)
async def rate_sighting(sighting_id: str, rating_data: RatingCreate):
    """Add a credibility rating to a sighting."""
    if rating_data.score < 1 or rating_data.score > 5:
        raise HTTPException(status_code=400, detail="Score must be between 1 and 5")
    
    sighting = await db.sightings.find_one({"id": sighting_id})
    if not sighting:
        raise HTTPException(status_code=404, detail="Sighting not found")
    
    rating = Rating(**rating_data.model_dump())
    rating_doc = rating.model_dump()
    rating_doc['timestamp'] = rating_doc['timestamp'].isoformat()
    
    await db.sightings.update_one(
        {"id": sighting_id},
        {
            "$push": {"ratings": rating_doc},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return await get_sighting(sighting_id)

@api_router.post("/sightings/{sighting_id}/analyze", response_model=Sighting)
async def reanalyze_sighting(sighting_id: str):
    """Re-run AI analysis on a sighting."""
    sighting_doc = await db.sightings.find_one({"id": sighting_id}, {"_id": 0})
    if not sighting_doc:
        raise HTTPException(status_code=404, detail="Sighting not found")
    
    # Convert dates
    if isinstance(sighting_doc.get('date_occurred'), str):
        sighting_doc['date_occurred'] = datetime.fromisoformat(sighting_doc['date_occurred'])
    if isinstance(sighting_doc.get('created_at'), str):
        sighting_doc['created_at'] = datetime.fromisoformat(sighting_doc['created_at'])
    if isinstance(sighting_doc.get('updated_at'), str):
        sighting_doc['updated_at'] = datetime.fromisoformat(sighting_doc['updated_at'])
    
    sighting = Sighting(**sighting_doc)
    sighting.ai_analysis = await perform_ai_analysis(sighting)
    
    ai_doc = sighting.ai_analysis.model_dump()
    ai_doc['timestamp'] = ai_doc['timestamp'].isoformat()
    
    await db.sightings.update_one(
        {"id": sighting_id},
        {
            "$set": {
                "ai_analysis": ai_doc,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return await get_sighting(sighting_id)

@api_router.post("/sightings/nearby")
async def get_nearby_sightings(query: NearbyQuery):
    """Get sightings within a radius of a location."""
    all_sightings = await db.sightings.find({}, {"_id": 0}).to_list(1000)
    
    nearby = []
    for s in all_sightings:
        distance = haversine_distance(
            query.latitude, query.longitude,
            s['location']['latitude'], s['location']['longitude']
        )
        if distance <= query.radius_km:
            s['distance_km'] = round(distance, 2)
            # Convert dates
            if isinstance(s.get('date_occurred'), str):
                s['date_occurred'] = datetime.fromisoformat(s['date_occurred'])
            if isinstance(s.get('created_at'), str):
                s['created_at'] = datetime.fromisoformat(s['created_at'])
            nearby.append(s)
    
    # Sort by distance
    nearby.sort(key=lambda x: x['distance_km'])
    return {"sightings": nearby, "count": len(nearby)}

@api_router.post("/sightings/{sighting_id}/verify")
async def verify_sighting(sighting_id: str, verified: bool = True):
    """Mark a sighting as verified or unverified."""
    result = await db.sightings.update_one(
        {"id": sighting_id},
        {
            "$set": {
                "verified": verified,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Sighting not found")
    
    return await get_sighting(sighting_id)

@api_router.delete("/sightings/{sighting_id}")
async def delete_sighting(sighting_id: str):
    """Delete a sighting."""
    result = await db.sightings.delete_one({"id": sighting_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sighting not found")
    return {"message": "Sighting deleted successfully"}

@api_router.get("/stats")
async def get_stats():
    """Get statistics about sightings."""
    total = await db.sightings.count_documents({})
    verified = await db.sightings.count_documents({"verified": True})
    
    # Category breakdown
    pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    category_stats = await db.sightings.aggregate(pipeline).to_list(100)
    
    return {
        "total_sightings": total,
        "verified_sightings": verified,
        "categories": {item['_id']: item['count'] for item in category_stats}
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
