from fastapi import FastAPI, APIRouter, HTTPException, Query, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
from openai import OpenAI
import math
import stripe

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

# Stripe configuration (test mode - user will add real keys)
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', 'sk_test_placeholder')

# Create the main app
app = FastAPI(title="ParaInvestigate API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============== CONSTANTS ==============
PARANORMAL_CATEGORIES = [
    "Ghost/Spirit", "UFO/UAP", "Cryptid", "Poltergeist", "Shadow Figure",
    "Orb", "EVP/Audio", "Unexplained Phenomenon", "Other"
]

HAUNTING_TYPES = [
    "Residual Haunting", "Intelligent Haunting", "Poltergeist Activity",
    "Demonic/Negative Entity", "Shadow People", "Portal Haunting",
    "Object Attachment", "Land/Location Based", "Other"
]

SEVERITY_LEVELS = ["Low", "Moderate", "High", "Severe", "Critical"]

EQUIPMENT_CATEGORIES = [
    "EMF Detectors", "Spirit Boxes", "Thermal Cameras", "Audio Recorders",
    "Full Spectrum Cameras", "Motion Sensors", "Laser Grids", "Dowsing Rods",
    "K-II Meters", "REM Pods", "Other"
]

# Subscription prices in GBP (pence)
SUBSCRIPTION_PRICES = {
    "monthly_user": 999,  # £9.99
    "monthly_investigator": 2000,  # £20
    "yearly_investigator": 20000,  # £200
}

# Video Ad prices in GBP (pence)
VIDEO_AD_PRICES = {
    "weekly_intro": 2000,  # £20/week (first 3 months)
    "weekly_standard": 5000,  # £50/week (after 3 months)
    "monthly_intro": 8000,  # £80/month (first 3 months) - 4 weeks
    "monthly_standard": 20000,  # £200/month (after 3 months)
}

AD_CATEGORIES = [
    "Paranormal Investigation Company",
    "YouTube Channel",
    "Podcast",
    "Equipment Retailer",
    "Paranormal Events",
    "Books/Media",
    "Training/Courses",
    "Other"
]

# Equipment Marketplace Listing Prices (pence)
EQUIPMENT_LISTING_PRICES = {
    "basic": 500,  # £5 for 30 days
    "featured": 1500,  # £15 for 30 days with featured placement
    "premium": 3000,  # £30 for 60 days with premium placement
}

EQUIPMENT_LISTING_TYPES = [
    "For Sale",
    "For Hire",
    "Wanted",
    "Swap/Exchange"
]

EQUIPMENT_CONDITIONS = [
    "Brand New",
    "Like New",
    "Good",
    "Fair",
    "For Parts/Repair"
]

# ============== MODELS ==============

class Location(BaseModel):
    latitude: float
    longitude: float
    address: Optional[str] = None

class Rating(BaseModel):
    user_id: str
    score: int
    comment: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AIAnalysis(BaseModel):
    credibility_score: int
    analysis_summary: str
    similar_cases: List[str]
    suggested_investigation_steps: List[str]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Sighting Models (existing)
class Sighting(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    category: str
    location: Location
    date_occurred: datetime
    evidence_photos: List[str] = []
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

class RatingCreate(BaseModel):
    user_id: str
    score: int
    comment: Optional[str] = None

class NearbyQuery(BaseModel):
    latitude: float
    longitude: float
    radius_km: float = 50.0

# ============== HAUNTING REPORT MODELS ==============

class HauntingSeverityAssessment(BaseModel):
    overall_severity: str  # Low, Moderate, High, Severe, Critical
    severity_score: int  # 1-100
    psychological_impact: str
    psychological_score: int  # 1-10
    physical_danger: str
    physical_score: int  # 1-10
    urgency_level: str
    recommended_actions: List[str]
    warning_signs: List[str]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class HauntingReport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    # Property details
    property_type: str  # House, Apartment, Business, Land, Other
    property_age: Optional[str] = None
    property_history: Optional[str] = None
    location: Location
    # Activity details
    haunting_type: str
    activity_description: str
    frequency: str  # Daily, Weekly, Monthly, Occasional
    duration_months: int  # How long has this been happening
    triggers: Optional[str] = None
    # Impact assessment
    psychological_symptoms: List[str] = []  # anxiety, sleep issues, etc.
    physical_symptoms: List[str] = []  # scratches, bruises, etc.
    witnesses: int = 1
    evidence_photos: List[str] = []
    evidence_audio: List[str] = []
    evidence_video: List[str] = []
    # Reporter info
    reporter_name: str
    reporter_email: str
    reporter_phone: Optional[str] = None
    # Privacy & Status
    visibility: str = "subscribers"  # "public", "subscribers", "private"
    seeking_help: bool = True
    urgent: bool = False
    # AI Assessment
    severity_assessment: Optional[HauntingSeverityAssessment] = None
    # Meta
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "pending"  # pending, under_review, investigated, resolved
    assigned_investigator_id: Optional[str] = None

class HauntingReportCreate(BaseModel):
    property_type: str
    property_age: Optional[str] = None
    property_history: Optional[str] = None
    location: Location
    haunting_type: str
    activity_description: str
    frequency: str
    duration_months: int
    triggers: Optional[str] = None
    psychological_symptoms: List[str] = []
    physical_symptoms: List[str] = []
    witnesses: int = 1
    evidence_photos: List[str] = []
    reporter_name: str
    reporter_email: str
    reporter_phone: Optional[str] = None
    visibility: str = "subscribers"
    seeking_help: bool = True
    urgent: bool = False

# ============== INVESTIGATOR MODELS ==============

class InvestigatorService(BaseModel):
    name: str
    description: str
    price_range: Optional[str] = None

class InvestigatorProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    # Basic Info
    name: str
    email: str
    phone: Optional[str] = None
    profile_photo: Optional[str] = None
    bio: str
    # Experience
    years_experience: int
    specializations: List[str] = []
    certifications: List[str] = []
    notable_cases: Optional[str] = None
    # Services
    services: List[InvestigatorService] = []
    # Location
    service_areas: List[str] = []  # Cities/regions they cover
    location: Optional[Location] = None
    willing_to_travel: bool = True
    travel_radius_km: int = 100
    # Equipment
    equipment_list: List[str] = []
    # Social/Contact
    website: Optional[str] = None
    social_links: dict = {}
    # Subscription
    subscription_type: str = "monthly"  # monthly, yearly
    subscription_status: str = "inactive"  # active, inactive, expired
    subscription_expires: Optional[datetime] = None
    featured: bool = False  # Premium featured listing
    # Stats
    total_investigations: int = 0
    rating: float = 0.0
    review_count: int = 0
    # Meta
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    verified: bool = False

class InvestigatorCreate(BaseModel):
    user_id: str
    name: str
    email: str
    phone: Optional[str] = None
    profile_photo: Optional[str] = None
    bio: str
    years_experience: int
    specializations: List[str] = []
    certifications: List[str] = []
    notable_cases: Optional[str] = None
    services: List[InvestigatorService] = []
    service_areas: List[str] = []
    location: Optional[Location] = None
    willing_to_travel: bool = True
    travel_radius_km: int = 100
    equipment_list: List[str] = []
    website: Optional[str] = None
    social_links: dict = {}

class InvestigatorReview(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    investigator_id: str
    user_id: str
    user_name: str
    rating: int  # 1-5
    review_text: str
    case_type: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== BOOKING MODELS ==============

class Booking(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    investigator_id: str
    client_user_id: str
    haunting_report_id: Optional[str] = None
    # Details
    client_name: str
    client_email: str
    client_phone: Optional[str] = None
    location: Location
    preferred_dates: List[str] = []
    message: str
    service_requested: Optional[str] = None
    # Status
    status: str = "pending"  # pending, accepted, declined, completed, cancelled
    investigator_notes: Optional[str] = None
    # Meta
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BookingCreate(BaseModel):
    investigator_id: str
    haunting_report_id: Optional[str] = None
    client_name: str
    client_email: str
    client_phone: Optional[str] = None
    location: Location
    preferred_dates: List[str] = []
    message: str
    service_requested: Optional[str] = None

# ============== EQUIPMENT MODELS ==============

class EquipmentReview(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    # Product info
    name: str
    brand: str
    category: str
    model_number: Optional[str] = None
    price_range: str  # Budget, Mid-range, Professional
    purchase_link: Optional[str] = None  # Affiliate link
    image_url: Optional[str] = None
    # Review
    reviewer_id: str
    reviewer_name: str
    reviewer_type: str  # "investigator" or "user"
    rating: int  # 1-5
    review_title: str
    review_text: str
    pros: List[str] = []
    cons: List[str] = []
    recommended: bool = True
    use_cases: List[str] = []
    # Meta
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    helpful_votes: int = 0
    verified_purchase: bool = False

class EquipmentReviewCreate(BaseModel):
    name: str
    brand: str
    category: str
    model_number: Optional[str] = None
    price_range: str
    purchase_link: Optional[str] = None
    image_url: Optional[str] = None
    reviewer_id: str
    reviewer_name: str
    reviewer_type: str
    rating: int
    review_title: str
    review_text: str
    pros: List[str] = []
    cons: List[str] = []
    recommended: bool = True
    use_cases: List[str] = []

# ============== SUBSCRIPTION MODELS ==============

class Subscription(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_email: str
    subscription_type: str  # "user", "investigator"
    plan: str  # "monthly", "yearly"
    status: str = "active"  # active, cancelled, expired
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    amount_gbp: int  # in pence
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime
    auto_renew: bool = True

class SubscriptionCreate(BaseModel):
    user_id: str
    user_email: str
    subscription_type: str
    plan: str

# ============== DONATION MODELS ==============

class Donation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    investigator_id: str
    donor_id: Optional[str] = None
    donor_name: str
    amount_gbp: int  # in pence
    message: Optional[str] = None
    anonymous: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DonationCreate(BaseModel):
    investigator_id: str
    donor_id: Optional[str] = None
    donor_name: str
    amount_gbp: int
    message: Optional[str] = None
    anonymous: bool = False

# ============== VIDEO AD MODELS ==============

class VideoAd(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    # Advertiser info
    advertiser_name: str
    advertiser_email: str
    company_name: str
    category: str
    # Ad content
    video_url: str  # URL to video file or base64
    thumbnail_url: Optional[str] = None
    title: str
    description: str
    click_url: str  # Where to redirect when clicked
    # Targeting
    target_pages: List[str] = []  # Which pages to show on
    # Payment & Duration
    plan: str  # weekly, monthly, quarterly
    amount_paid_gbp: int
    start_date: datetime
    end_date: datetime
    # Stats
    impressions: int = 0
    clicks: int = 0
    # Status
    status: str = "pending"  # pending, active, paused, expired, rejected
    approved: bool = False
    # Meta
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class VideoAdCreate(BaseModel):
    advertiser_name: str
    advertiser_email: str
    company_name: str
    category: str
    video_url: str
    thumbnail_url: Optional[str] = None
    title: str
    description: str
    click_url: str
    target_pages: List[str] = []
    plan: str

# ============== AI REPORT GENERATOR MODELS ==============

class AIGeneratedReport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    # Input
    raw_input: str
    input_type: str  # "text", "url", "mixed"
    # Generated content
    title: str
    summary: str
    detailed_description: str
    category: str
    haunting_type: Optional[str] = None
    # Extracted data
    locations: List[Location] = []
    dates_mentioned: List[str] = []
    witnesses_mentioned: int = 0
    entities_described: List[str] = []
    # Media suggestions
    suggested_images: List[str] = []
    audio_transcriptions: List[str] = []
    # Analysis
    credibility_assessment: str
    severity_assessment: Optional[str] = None
    key_evidence: List[str] = []
    investigation_recommendations: List[str] = []
    similar_cases: List[str] = []
    # Meta
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    generator_user_id: Optional[str] = None

class AIReportRequest(BaseModel):
    raw_text: str
    include_location_extraction: bool = True
    include_media_suggestions: bool = True
    report_type: str = "auto"  # "sighting", "haunting", "auto"

# ============== HELPER FUNCTIONS ==============

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371
    lat1_rad, lat2_rad = math.radians(lat1), math.radians(lat2)
    delta_lat, delta_lon = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

async def perform_ai_analysis(sighting: Sighting) -> AIAnalysis:
    try:
        prompt = f"""Analyze this paranormal sighting report:
Title: {sighting.title}
Category: {sighting.category}
Description: {sighting.description}
Location: {sighting.location.address or f"Lat: {sighting.location.latitude}, Lon: {sighting.location.longitude}"}
Witnesses: {sighting.witness_count}
Date: {sighting.date_occurred}

Provide:
1. Credibility score 1-100
2. Brief analysis (2-3 sentences)
3. 2-3 similar historical cases
4. 3-4 investigation steps

Format:
CREDIBILITY: [score]
SUMMARY: [summary]
SIMILAR CASES: [case1] | [case2] | [case3]
INVESTIGATION STEPS: [step1] | [step2] | [step3]"""

        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
            temperature=0.7
        )
        result = response.choices[0].message.content
        lines = result.strip().split('\n')
        credibility, summary = 50, "Analysis pending."
        similar_cases, investigation_steps = [], []
        
        for line in lines:
            if line.startswith('CREDIBILITY:'): credibility = int(line.replace('CREDIBILITY:', '').strip())
            elif line.startswith('SUMMARY:'): summary = line.replace('SUMMARY:', '').strip()
            elif line.startswith('SIMILAR CASES:'): similar_cases = [c.strip() for c in line.replace('SIMILAR CASES:', '').split('|')]
            elif line.startswith('INVESTIGATION STEPS:'): investigation_steps = [s.strip() for s in line.replace('INVESTIGATION STEPS:', '').split('|')]
        
        return AIAnalysis(credibility_score=credibility, analysis_summary=summary, similar_cases=similar_cases[:3], suggested_investigation_steps=investigation_steps[:4])
    except Exception as e:
        logger.error(f"AI analysis failed: {e}")
        return AIAnalysis(credibility_score=50, analysis_summary="AI analysis unavailable. Manual review recommended.",
                         similar_cases=["Unable to fetch similar cases"], suggested_investigation_steps=["Document all evidence", "Interview witnesses", "Research location history"])

async def perform_haunting_severity_assessment(report: HauntingReportCreate) -> HauntingSeverityAssessment:
    try:
        prompt = f"""Assess the severity of this haunting report. Be thorough and consider psychological and physical safety.

Property Type: {report.property_type}
Property History: {report.property_history or 'Unknown'}
Haunting Type: {report.haunting_type}
Activity Description: {report.activity_description}
Frequency: {report.frequency}
Duration: {report.duration_months} months
Psychological Symptoms Reported: {', '.join(report.psychological_symptoms) if report.psychological_symptoms else 'None reported'}
Physical Symptoms Reported: {', '.join(report.physical_symptoms) if report.physical_symptoms else 'None reported'}
Witnesses: {report.witnesses}
Urgent: {report.urgent}

Assess severity and provide:
1. Overall severity (Low/Moderate/High/Severe/Critical)
2. Severity score (1-100)
3. Psychological impact description
4. Psychological score (1-10)
5. Physical danger assessment
6. Physical danger score (1-10)
7. Urgency level
8. 3-5 recommended actions
9. Warning signs to watch for

Format response as:
SEVERITY: [level]
SEVERITY_SCORE: [1-100]
PSYCHOLOGICAL: [description]
PSYCH_SCORE: [1-10]
PHYSICAL: [description]
PHYSICAL_SCORE: [1-10]
URGENCY: [level]
ACTIONS: [action1] | [action2] | [action3]
WARNINGS: [warning1] | [warning2] | [warning3]"""

        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800,
            temperature=0.5
        )
        result = response.choices[0].message.content
        lines = result.strip().split('\n')
        
        severity, severity_score = "Moderate", 50
        psych_impact, psych_score = "Assessment pending", 5
        physical_danger, physical_score = "Assessment pending", 3
        urgency = "Normal"
        actions, warnings = [], []
        
        for line in lines:
            if line.startswith('SEVERITY:'): severity = line.replace('SEVERITY:', '').strip()
            elif line.startswith('SEVERITY_SCORE:'): severity_score = int(line.replace('SEVERITY_SCORE:', '').strip())
            elif line.startswith('PSYCHOLOGICAL:'): psych_impact = line.replace('PSYCHOLOGICAL:', '').strip()
            elif line.startswith('PSYCH_SCORE:'): psych_score = int(line.replace('PSYCH_SCORE:', '').strip())
            elif line.startswith('PHYSICAL:'): physical_danger = line.replace('PHYSICAL:', '').strip()
            elif line.startswith('PHYSICAL_SCORE:'): physical_score = int(line.replace('PHYSICAL_SCORE:', '').strip())
            elif line.startswith('URGENCY:'): urgency = line.replace('URGENCY:', '').strip()
            elif line.startswith('ACTIONS:'): actions = [a.strip() for a in line.replace('ACTIONS:', '').split('|')]
            elif line.startswith('WARNINGS:'): warnings = [w.strip() for w in line.replace('WARNINGS:', '').split('|')]
        
        return HauntingSeverityAssessment(
            overall_severity=severity, severity_score=severity_score,
            psychological_impact=psych_impact, psychological_score=psych_score,
            physical_danger=physical_danger, physical_score=physical_score,
            urgency_level=urgency, recommended_actions=actions[:5], warning_signs=warnings[:5]
        )
    except Exception as e:
        logger.error(f"Severity assessment failed: {e}")
        return HauntingSeverityAssessment(
            overall_severity="Moderate", severity_score=50,
            psychological_impact="Assessment unavailable - please consult professional",
            psychological_score=5, physical_danger="Unknown - exercise caution",
            physical_score=5, urgency_level="Normal",
            recommended_actions=["Document all activity", "Seek professional investigator", "Consider property blessing"],
            warning_signs=["Increased activity", "Physical manifestations", "Emotional disturbances"]
        )

def serialize_datetime(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj

def convert_doc_dates(doc: dict) -> dict:
    date_fields = ['date_occurred', 'created_at', 'updated_at', 'timestamp', 'started_at', 'expires_at', 'subscription_expires']
    for field in date_fields:
        if field in doc and isinstance(doc[field], str):
            doc[field] = datetime.fromisoformat(doc[field])
    if 'ai_analysis' in doc and doc['ai_analysis'] and isinstance(doc['ai_analysis'].get('timestamp'), str):
        doc['ai_analysis']['timestamp'] = datetime.fromisoformat(doc['ai_analysis']['timestamp'])
    if 'severity_assessment' in doc and doc['severity_assessment'] and isinstance(doc['severity_assessment'].get('timestamp'), str):
        doc['severity_assessment']['timestamp'] = datetime.fromisoformat(doc['severity_assessment']['timestamp'])
    for rating in doc.get('ratings', []):
        if isinstance(rating.get('timestamp'), str):
            rating['timestamp'] = datetime.fromisoformat(rating['timestamp'])
    return doc

# ============== SIGHTING ROUTES (Existing) ==============

@api_router.get("/")
async def root():
    return {"message": "ParaInvestigate API", "version": "2.0.0"}

@api_router.get("/categories")
async def get_categories():
    return {"categories": PARANORMAL_CATEGORIES, "haunting_types": HAUNTING_TYPES, "equipment_categories": EQUIPMENT_CATEGORIES}

@api_router.post("/sightings", response_model=Sighting)
async def create_sighting(sighting_data: SightingCreate):
    if sighting_data.category not in PARANORMAL_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category")
    sighting = Sighting(**sighting_data.model_dump())
    sighting.ai_analysis = await perform_ai_analysis(sighting)
    doc = sighting.model_dump()
    for key in ['date_occurred', 'created_at', 'updated_at']:
        doc[key] = doc[key].isoformat()
    if doc['ai_analysis']:
        doc['ai_analysis']['timestamp'] = doc['ai_analysis']['timestamp'].isoformat()
    await db.sightings.insert_one(doc)
    return sighting

@api_router.get("/sightings", response_model=List[Sighting])
async def get_sightings(category: Optional[str] = None, verified: Optional[bool] = None, limit: int = 100, skip: int = 0):
    query = {}
    if category: query['category'] = category
    if verified is not None: query['verified'] = verified
    cursor = db.sightings.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1)
    sightings = await cursor.to_list(limit)
    return [convert_doc_dates(s) for s in sightings]

@api_router.get("/sightings/{sighting_id}", response_model=Sighting)
async def get_sighting(sighting_id: str):
    sighting = await db.sightings.find_one({"id": sighting_id}, {"_id": 0})
    if not sighting: raise HTTPException(status_code=404, detail="Sighting not found")
    return convert_doc_dates(sighting)

@api_router.post("/sightings/{sighting_id}/rate", response_model=Sighting)
async def rate_sighting(sighting_id: str, rating_data: RatingCreate):
    if not 1 <= rating_data.score <= 5:
        raise HTTPException(status_code=400, detail="Score must be 1-5")
    sighting = await db.sightings.find_one({"id": sighting_id})
    if not sighting: raise HTTPException(status_code=404, detail="Sighting not found")
    rating = Rating(**rating_data.model_dump())
    await db.sightings.update_one({"id": sighting_id}, {
        "$push": {"ratings": {**rating.model_dump(), "timestamp": rating.timestamp.isoformat()}},
        "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
    })
    return await get_sighting(sighting_id)

@api_router.post("/sightings/{sighting_id}/analyze", response_model=Sighting)
async def reanalyze_sighting(sighting_id: str):
    sighting_doc = await db.sightings.find_one({"id": sighting_id}, {"_id": 0})
    if not sighting_doc: raise HTTPException(status_code=404, detail="Sighting not found")
    sighting = Sighting(**convert_doc_dates(sighting_doc))
    sighting.ai_analysis = await perform_ai_analysis(sighting)
    ai_doc = sighting.ai_analysis.model_dump()
    ai_doc['timestamp'] = ai_doc['timestamp'].isoformat()
    await db.sightings.update_one({"id": sighting_id}, {"$set": {"ai_analysis": ai_doc, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return await get_sighting(sighting_id)

@api_router.post("/sightings/nearby")
async def get_nearby_sightings(query: NearbyQuery):
    all_sightings = await db.sightings.find({}, {"_id": 0}).to_list(1000)
    nearby = []
    for s in all_sightings:
        distance = haversine_distance(query.latitude, query.longitude, s['location']['latitude'], s['location']['longitude'])
        if distance <= query.radius_km:
            s['distance_km'] = round(distance, 2)
            nearby.append(convert_doc_dates(s))
    nearby.sort(key=lambda x: x['distance_km'])
    return {"sightings": nearby, "count": len(nearby)}

@api_router.get("/stats")
async def get_stats():
    total = await db.sightings.count_documents({})
    verified = await db.sightings.count_documents({"verified": True})
    pipeline = [{"$group": {"_id": "$category", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    category_stats = await db.sightings.aggregate(pipeline).to_list(100)
    haunting_count = await db.haunting_reports.count_documents({})
    investigator_count = await db.investigators.count_documents({"subscription_status": "active"})
    equipment_count = await db.equipment_reviews.count_documents({})
    return {
        "total_sightings": total, "verified_sightings": verified,
        "categories": {item['_id']: item['count'] for item in category_stats},
        "haunting_reports": haunting_count, "active_investigators": investigator_count,
        "equipment_reviews": equipment_count
    }

# ============== HAUNTING REPORT ROUTES ==============

@api_router.post("/hauntings", response_model=HauntingReport)
async def create_haunting_report(report_data: HauntingReportCreate):
    report = HauntingReport(**report_data.model_dump())
    report.severity_assessment = await perform_haunting_severity_assessment(report_data)
    doc = report.model_dump()
    for key in ['created_at', 'updated_at']:
        doc[key] = doc[key].isoformat()
    if doc['severity_assessment']:
        doc['severity_assessment']['timestamp'] = doc['severity_assessment']['timestamp'].isoformat()
    await db.haunting_reports.insert_one(doc)
    return report

@api_router.get("/hauntings")
async def get_haunting_reports(
    visibility: Optional[str] = None,
    status: Optional[str] = None,
    seeking_help: Optional[bool] = None,
    is_subscriber: bool = False,
    limit: int = 50,
    skip: int = 0
):
    query = {}
    if not is_subscriber:
        query['visibility'] = 'public'
    elif visibility:
        query['visibility'] = visibility
    if status: query['status'] = status
    if seeking_help is not None: query['seeking_help'] = seeking_help
    
    cursor = db.haunting_reports.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1)
    reports = await cursor.to_list(limit)
    
    result = []
    for r in reports:
        r = convert_doc_dates(r)
        if not is_subscriber and r.get('visibility') != 'public':
            r = {
                "id": r["id"],
                "haunting_type": r["haunting_type"],
                "location": {"latitude": r["location"]["latitude"], "longitude": r["location"]["longitude"]},
                "severity_assessment": {"overall_severity": r.get("severity_assessment", {}).get("overall_severity", "Unknown")},
                "created_at": r["created_at"],
                "preview": True,
                "message": "Subscribe to view full report details"
            }
        result.append(r)
    return {"reports": result, "count": len(result)}

@api_router.get("/hauntings/{report_id}")
async def get_haunting_report(report_id: str, is_subscriber: bool = False):
    report = await db.haunting_reports.find_one({"id": report_id}, {"_id": 0})
    if not report: raise HTTPException(status_code=404, detail="Report not found")
    report = convert_doc_dates(report)
    
    if not is_subscriber and report.get('visibility') != 'public':
        return {
            "id": report["id"],
            "haunting_type": report["haunting_type"],
            "severity_assessment": {"overall_severity": report.get("severity_assessment", {}).get("overall_severity", "Unknown")},
            "preview": True,
            "message": "Subscribe to view full report details"
        }
    return report

@api_router.post("/hauntings/{report_id}/request-help")
async def request_investigator_help(report_id: str, investigator_id: str):
    report = await db.haunting_reports.find_one({"id": report_id})
    if not report: raise HTTPException(status_code=404, detail="Report not found")
    investigator = await db.investigators.find_one({"id": investigator_id})
    if not investigator: raise HTTPException(status_code=404, detail="Investigator not found")
    
    booking = Booking(
        investigator_id=investigator_id,
        client_user_id=report.get('reporter_email', ''),
        haunting_report_id=report_id,
        client_name=report['reporter_name'],
        client_email=report['reporter_email'],
        client_phone=report.get('reporter_phone'),
        location=Location(**report['location']),
        message=f"Help requested for haunting report: {report['haunting_type']}",
        service_requested="Investigation"
    )
    doc = booking.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.bookings.insert_one(doc)
    return {"message": "Help request sent to investigator", "booking_id": booking.id}

# ============== INVESTIGATOR ROUTES ==============

@api_router.post("/investigators", response_model=InvestigatorProfile)
async def create_investigator_profile(profile_data: InvestigatorCreate):
    existing = await db.investigators.find_one({"user_id": profile_data.user_id})
    if existing: raise HTTPException(status_code=400, detail="Profile already exists")
    profile = InvestigatorProfile(**profile_data.model_dump())
    doc = profile.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    if doc.get('subscription_expires'):
        doc['subscription_expires'] = doc['subscription_expires'].isoformat()
    await db.investigators.insert_one(doc)
    return profile

@api_router.get("/investigators")
async def get_investigators(
    specialization: Optional[str] = None,
    service_area: Optional[str] = None,
    featured: Optional[bool] = None,
    active_only: bool = True,
    limit: int = 50,
    skip: int = 0
):
    query = {}
    if active_only: query['subscription_status'] = 'active'
    if specialization: query['specializations'] = specialization
    if service_area: query['service_areas'] = {"$regex": service_area, "$options": "i"}
    if featured is not None: query['featured'] = featured
    
    cursor = db.investigators.find(query, {"_id": 0}).skip(skip).limit(limit).sort([("featured", -1), ("rating", -1)])
    investigators = await cursor.to_list(limit)
    return {"investigators": [convert_doc_dates(i) for i in investigators], "count": len(investigators)}

@api_router.get("/investigators/{investigator_id}")
async def get_investigator(investigator_id: str):
    investigator = await db.investigators.find_one({"id": investigator_id}, {"_id": 0})
    if not investigator: raise HTTPException(status_code=404, detail="Investigator not found")
    reviews = await db.investigator_reviews.find({"investigator_id": investigator_id}, {"_id": 0}).sort("timestamp", -1).to_list(20)
    investigator['reviews'] = [convert_doc_dates(r) for r in reviews]
    return convert_doc_dates(investigator)

@api_router.put("/investigators/{investigator_id}")
async def update_investigator(investigator_id: str, updates: dict):
    updates['updated_at'] = datetime.now(timezone.utc).isoformat()
    result = await db.investigators.update_one({"id": investigator_id}, {"$set": updates})
    if result.modified_count == 0: raise HTTPException(status_code=404, detail="Investigator not found")
    return await get_investigator(investigator_id)

@api_router.post("/investigators/{investigator_id}/review")
async def review_investigator(investigator_id: str, user_id: str, user_name: str, rating: int, review_text: str, case_type: Optional[str] = None):
    if not 1 <= rating <= 5: raise HTTPException(status_code=400, detail="Rating must be 1-5")
    investigator = await db.investigators.find_one({"id": investigator_id})
    if not investigator: raise HTTPException(status_code=404, detail="Investigator not found")
    
    review = InvestigatorReview(investigator_id=investigator_id, user_id=user_id, user_name=user_name, rating=rating, review_text=review_text, case_type=case_type)
    doc = review.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.investigator_reviews.insert_one(doc)
    
    all_reviews = await db.investigator_reviews.find({"investigator_id": investigator_id}).to_list(1000)
    avg_rating = sum(r['rating'] for r in all_reviews) / len(all_reviews)
    await db.investigators.update_one({"id": investigator_id}, {"$set": {"rating": round(avg_rating, 1), "review_count": len(all_reviews)}})
    return {"message": "Review submitted", "review_id": review.id}

@api_router.post("/investigators/{investigator_id}/donate")
async def donate_to_investigator(investigator_id: str, donation_data: DonationCreate):
    investigator = await db.investigators.find_one({"id": investigator_id})
    if not investigator: raise HTTPException(status_code=404, detail="Investigator not found")
    donation = Donation(**donation_data.model_dump())
    doc = donation.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.donations.insert_one(doc)
    return {"message": "Donation recorded", "donation_id": donation.id, "amount_gbp": donation.amount_gbp / 100}

# ============== BOOKING ROUTES ==============

@api_router.post("/bookings", response_model=Booking)
async def create_booking(booking_data: BookingCreate):
    investigator = await db.investigators.find_one({"id": booking_data.investigator_id})
    if not investigator: raise HTTPException(status_code=404, detail="Investigator not found")
    booking = Booking(**booking_data.model_dump())
    doc = booking.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.bookings.insert_one(doc)
    return booking

@api_router.get("/bookings")
async def get_bookings(investigator_id: Optional[str] = None, client_email: Optional[str] = None, status: Optional[str] = None):
    query = {}
    if investigator_id: query['investigator_id'] = investigator_id
    if client_email: query['client_email'] = client_email
    if status: query['status'] = status
    cursor = db.bookings.find(query, {"_id": 0}).sort("created_at", -1)
    bookings = await cursor.to_list(100)
    return {"bookings": [convert_doc_dates(b) for b in bookings]}

@api_router.put("/bookings/{booking_id}/status")
async def update_booking_status(booking_id: str, status: str, notes: Optional[str] = None):
    valid_statuses = ["pending", "accepted", "declined", "completed", "cancelled"]
    if status not in valid_statuses: raise HTTPException(status_code=400, detail="Invalid status")
    update = {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}
    if notes: update['investigator_notes'] = notes
    result = await db.bookings.update_one({"id": booking_id}, {"$set": update})
    if result.modified_count == 0: raise HTTPException(status_code=404, detail="Booking not found")
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    return convert_doc_dates(booking)

# ============== EQUIPMENT ROUTES ==============

@api_router.post("/equipment", response_model=EquipmentReview)
async def create_equipment_review(review_data: EquipmentReviewCreate):
    if review_data.category not in EQUIPMENT_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category")
    review = EquipmentReview(**review_data.model_dump())
    doc = review.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.equipment_reviews.insert_one(doc)
    return review

@api_router.get("/equipment")
async def get_equipment_reviews(
    category: Optional[str] = None,
    recommended: Optional[bool] = None,
    min_rating: Optional[int] = None,
    limit: int = 50,
    skip: int = 0
):
    query = {}
    if category: query['category'] = category
    if recommended is not None: query['recommended'] = recommended
    if min_rating: query['rating'] = {"$gte": min_rating}
    cursor = db.equipment_reviews.find(query, {"_id": 0}).skip(skip).limit(limit).sort([("helpful_votes", -1), ("rating", -1)])
    reviews = await cursor.to_list(limit)
    return {"reviews": [convert_doc_dates(r) for r in reviews], "count": len(reviews)}

@api_router.get("/equipment/{review_id}")
async def get_equipment_review(review_id: str):
    review = await db.equipment_reviews.find_one({"id": review_id}, {"_id": 0})
    if not review: raise HTTPException(status_code=404, detail="Review not found")
    return convert_doc_dates(review)

@api_router.post("/equipment/{review_id}/helpful")
async def mark_review_helpful(review_id: str):
    result = await db.equipment_reviews.update_one({"id": review_id}, {"$inc": {"helpful_votes": 1}})
    if result.modified_count == 0: raise HTTPException(status_code=404, detail="Review not found")
    return {"message": "Marked as helpful"}

@api_router.get("/equipment/top-rated")
async def get_top_equipment(category: Optional[str] = None, limit: int = 10):
    pipeline = [{"$match": {"category": category}} if category else {"$match": {}},
                {"$group": {"_id": "$name", "avg_rating": {"$avg": "$rating"}, "review_count": {"$sum": 1}, "recommended_count": {"$sum": {"$cond": ["$recommended", 1, 0]}}}},
                {"$sort": {"avg_rating": -1, "review_count": -1}},
                {"$limit": limit}]
    results = await db.equipment_reviews.aggregate(pipeline).to_list(limit)
    return {"top_equipment": results}

# ============== SUBSCRIPTION ROUTES ==============

@api_router.get("/subscription/plans")
async def get_subscription_plans():
    return {
        "plans": [
            {"id": "user_monthly", "name": "Monthly Subscription", "type": "user", "price_gbp": 9.99, "price_pence": 999, "features": ["Access all detailed reports", "View haunting case details", "Contact investigators", "Equipment reviews", "Community features"]},
            {"id": "investigator_monthly", "name": "Investigator Monthly", "type": "investigator", "price_gbp": 20.00, "price_pence": 2000, "features": ["List your services", "Receive booking requests", "Featured in directory", "Accept donations", "All user features"]},
            {"id": "investigator_yearly", "name": "Investigator Yearly", "type": "investigator", "price_gbp": 200.00, "price_pence": 20000, "features": ["All monthly features", "Save £40/year", "Priority support", "Featured listing boost"]}
        ]
    }

@api_router.post("/subscription/create")
async def create_subscription(sub_data: SubscriptionCreate):
    # Calculate expiry
    if sub_data.plan == "yearly":
        expires = datetime.now(timezone.utc) + timedelta(days=365)
        amount = SUBSCRIPTION_PRICES.get(f"yearly_{sub_data.subscription_type}", 20000)
    else:
        expires = datetime.now(timezone.utc) + timedelta(days=30)
        amount = SUBSCRIPTION_PRICES.get(f"monthly_{sub_data.subscription_type}", 999)
    
    subscription = Subscription(
        user_id=sub_data.user_id,
        user_email=sub_data.user_email,
        subscription_type=sub_data.subscription_type,
        plan=sub_data.plan,
        amount_gbp=amount,
        expires_at=expires
    )
    doc = subscription.model_dump()
    doc['started_at'] = doc['started_at'].isoformat()
    doc['expires_at'] = doc['expires_at'].isoformat()
    await db.subscriptions.insert_one(doc)
    
    # If investigator, update their profile
    if sub_data.subscription_type == "investigator":
        await db.investigators.update_one(
            {"user_id": sub_data.user_id},
            {"$set": {"subscription_status": "active", "subscription_type": sub_data.plan, "subscription_expires": expires.isoformat()}}
        )
    
    return {"subscription": subscription, "message": "Subscription created successfully"}

@api_router.get("/subscription/check/{user_id}")
async def check_subscription(user_id: str):
    subscription = await db.subscriptions.find_one({"user_id": user_id, "status": "active"}, {"_id": 0})
    if not subscription:
        return {"is_subscriber": False, "subscription": None}
    
    expires_at = datetime.fromisoformat(subscription['expires_at']) if isinstance(subscription['expires_at'], str) else subscription['expires_at']
    if expires_at < datetime.now(timezone.utc):
        await db.subscriptions.update_one({"id": subscription['id']}, {"$set": {"status": "expired"}})
        return {"is_subscriber": False, "subscription": None, "message": "Subscription expired"}
    
    return {"is_subscriber": True, "subscription": convert_doc_dates(subscription)}

@api_router.post("/subscription/cancel/{subscription_id}")
async def cancel_subscription(subscription_id: str):
    result = await db.subscriptions.update_one({"id": subscription_id}, {"$set": {"status": "cancelled", "auto_renew": False}})
    if result.modified_count == 0: raise HTTPException(status_code=404, detail="Subscription not found")
    return {"message": "Subscription cancelled"}

# ============== REVENUE/ADMIN STATS ==============

@api_router.get("/admin/revenue")
async def get_revenue_stats():
    # Total subscriptions
    active_subs = await db.subscriptions.count_documents({"status": "active"})
    
    # Revenue calculation
    subs = await db.subscriptions.find({"status": "active"}).to_list(1000)
    total_mrr = sum(s.get('amount_gbp', 0) for s in subs if s.get('plan') == 'monthly')
    
    # Donations
    donations = await db.donations.find({}).to_list(1000)
    total_donations = sum(d.get('amount_gbp', 0) for d in donations)
    
    # Investigator subscriptions
    investigator_subs = await db.subscriptions.count_documents({"status": "active", "subscription_type": "investigator"})
    user_subs = await db.subscriptions.count_documents({"status": "active", "subscription_type": "user"})
    
    return {
        "active_subscriptions": active_subs,
        "investigator_subscriptions": investigator_subs,
        "user_subscriptions": user_subs,
        "monthly_recurring_revenue_pence": total_mrr,
        "monthly_recurring_revenue_gbp": total_mrr / 100,
        "total_donations_pence": total_donations,
        "total_donations_gbp": total_donations / 100
    }

# ============== VIDEO ADVERTISING ROUTES ==============

@api_router.get("/ads/pricing")
async def get_ad_pricing():
    return {
        "plans": [
            {
                "id": "weekly_intro", 
                "name": "Weekly (Introductory)", 
                "price_gbp": 20, 
                "price_pence": 2000, 
                "duration_days": 7,
                "description": "First 3 months - special launch rate!",
                "is_intro": True
            },
            {
                "id": "weekly_standard", 
                "name": "Weekly (Standard)", 
                "price_gbp": 50, 
                "price_pence": 5000, 
                "duration_days": 7,
                "description": "Standard rate after introductory period",
                "is_intro": False
            },
            {
                "id": "monthly_intro", 
                "name": "Monthly (Introductory)", 
                "price_gbp": 80, 
                "price_pence": 8000, 
                "duration_days": 30,
                "description": "First 3 months - save £80 vs weekly!",
                "is_intro": True
            },
            {
                "id": "monthly_standard", 
                "name": "Monthly (Standard)", 
                "price_gbp": 200, 
                "price_pence": 20000, 
                "duration_days": 30,
                "description": "Standard rate after introductory period",
                "is_intro": False
            }
        ],
        "categories": AD_CATEGORIES,
        "max_video_duration_seconds": 20,
        "supported_formats": ["mp4", "webm", "mov"],
        "intro_period_months": 3,
        "intro_offer": "£20/week for the first 3 months, then £50/week thereafter"
    }

@api_router.post("/ads", response_model=VideoAd)
async def create_video_ad(ad_data: VideoAdCreate):
    if ad_data.category not in AD_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category")
    
    # Calculate duration and pricing
    plan_config = {
        "weekly_intro": {"days": 7, "amount": 2000},
        "weekly_standard": {"days": 7, "amount": 5000},
        "monthly_intro": {"days": 30, "amount": 8000},
        "monthly_standard": {"days": 30, "amount": 20000}
    }
    
    config = plan_config.get(ad_data.plan, {"days": 7, "amount": 2000})
    duration_days = config["days"]
    amount = config["amount"]
    
    start_date = datetime.now(timezone.utc)
    end_date = start_date + timedelta(days=duration_days)
    
    ad = VideoAd(
        **ad_data.model_dump(),
        amount_paid_gbp=amount,
        start_date=start_date,
        end_date=end_date,
        status="pending"
    )
    
    doc = ad.model_dump()
    doc['start_date'] = doc['start_date'].isoformat()
    doc['end_date'] = doc['end_date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.video_ads.insert_one(doc)
    return ad

@api_router.get("/ads")
async def get_video_ads(
    status: Optional[str] = None,
    category: Optional[str] = None,
    active_only: bool = True,
    limit: int = 10
):
    query = {}
    if active_only:
        query['status'] = 'active'
        query['approved'] = True
        query['end_date'] = {"$gt": datetime.now(timezone.utc).isoformat()}
    elif status:
        query['status'] = status
    if category:
        query['category'] = category
    
    cursor = db.video_ads.find(query, {"_id": 0}).limit(limit)
    ads = await cursor.to_list(limit)
    return {"ads": [convert_doc_dates(a) for a in ads], "count": len(ads)}

@api_router.get("/ads/rotation")
async def get_ads_for_rotation(page: Optional[str] = None, limit: int = 5):
    """Get active ads for rotation display"""
    query = {
        'status': 'active',
        'approved': True,
        'end_date': {"$gt": datetime.now(timezone.utc).isoformat()}
    }
    if page:
        query['$or'] = [{'target_pages': page}, {'target_pages': {"$size": 0}}]
    
    cursor = db.video_ads.find(query, {"_id": 0}).limit(limit)
    ads = await cursor.to_list(limit)
    return {"ads": [convert_doc_dates(a) for a in ads]}

@api_router.post("/ads/{ad_id}/impression")
async def record_ad_impression(ad_id: str):
    result = await db.video_ads.update_one({"id": ad_id}, {"$inc": {"impressions": 1}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Ad not found")
    return {"message": "Impression recorded"}

@api_router.post("/ads/{ad_id}/click")
async def record_ad_click(ad_id: str):
    result = await db.video_ads.update_one({"id": ad_id}, {"$inc": {"clicks": 1}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Ad not found")
    ad = await db.video_ads.find_one({"id": ad_id}, {"_id": 0})
    return {"click_url": ad.get('click_url', ''), "message": "Click recorded"}

@api_router.put("/ads/{ad_id}/approve")
async def approve_video_ad(ad_id: str, approved: bool = True):
    update = {
        "approved": approved,
        "status": "active" if approved else "rejected",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.video_ads.update_one({"id": ad_id}, {"$set": update})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Ad not found")
    ad = await db.video_ads.find_one({"id": ad_id}, {"_id": 0})
    return convert_doc_dates(ad)

@api_router.get("/ads/{ad_id}")
async def get_video_ad(ad_id: str):
    ad = await db.video_ads.find_one({"id": ad_id}, {"_id": 0})
    if not ad:
        raise HTTPException(status_code=404, detail="Ad not found")
    return convert_doc_dates(ad)

# ============== AI REPORT GENERATOR ROUTES ==============

@api_router.post("/ai/generate-report", response_model=AIGeneratedReport)
async def generate_ai_report(request: AIReportRequest):
    """
    Takes raw text input and uses AI to generate a structured paranormal report.
    Extracts locations, dates, entities, and provides analysis.
    """
    try:
        prompt = f"""You are an expert paranormal researcher. Analyze the following raw information and create a structured paranormal report.

RAW INPUT:
{request.raw_text}

Extract and generate the following in a structured format:

1. TITLE: A compelling title for this report
2. CATEGORY: One of [Ghost/Spirit, UFO/UAP, Cryptid, Poltergeist, Shadow Figure, Orb, EVP/Audio, Unexplained Phenomenon, Other]
3. HAUNTING_TYPE: If applicable, one of [Residual Haunting, Intelligent Haunting, Poltergeist Activity, Demonic/Negative Entity, Shadow People, Portal Haunting, Object Attachment, Land/Location Based, Other] or "N/A"
4. SUMMARY: A 2-3 sentence summary of the incident
5. DETAILED_DESCRIPTION: A comprehensive narrative of the events (3-5 paragraphs)
6. LOCATIONS: Extract any locations mentioned as "lat,lng,address" format (one per line). If no specific coordinates, estimate based on place names. Use UK coordinates by default if unclear.
7. DATES: List any dates or time periods mentioned
8. WITNESSES: Estimated number of witnesses
9. ENTITIES: List any paranormal entities or phenomena described
10. CREDIBILITY: Assessment of credibility (Low/Medium/High) with brief explanation
11. SEVERITY: If haunting, rate severity (Low/Moderate/High/Severe/Critical)
12. KEY_EVIDENCE: List key pieces of evidence mentioned
13. RECOMMENDATIONS: Investigation recommendations
14. SIMILAR_CASES: Known similar historical cases

Format your response exactly as:
TITLE: [title]
CATEGORY: [category]
HAUNTING_TYPE: [type or N/A]
SUMMARY: [summary]
DETAILED_DESCRIPTION: [description]
LOCATIONS: [location1] | [location2]
DATES: [date1] | [date2]
WITNESSES: [number]
ENTITIES: [entity1] | [entity2]
CREDIBILITY: [assessment]
SEVERITY: [severity or N/A]
KEY_EVIDENCE: [evidence1] | [evidence2]
RECOMMENDATIONS: [rec1] | [rec2]
SIMILAR_CASES: [case1] | [case2]"""

        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000,
            temperature=0.7
        )
        
        result = response.choices[0].message.content
        lines = result.strip().split('\n')
        
        # Parse response
        parsed = {}
        current_key = None
        for line in lines:
            for key in ['TITLE:', 'CATEGORY:', 'HAUNTING_TYPE:', 'SUMMARY:', 'DETAILED_DESCRIPTION:', 
                       'LOCATIONS:', 'DATES:', 'WITNESSES:', 'ENTITIES:', 'CREDIBILITY:', 
                       'SEVERITY:', 'KEY_EVIDENCE:', 'RECOMMENDATIONS:', 'SIMILAR_CASES:']:
                if line.startswith(key):
                    current_key = key[:-1].lower()
                    parsed[current_key] = line[len(key):].strip()
                    break
        
        # Process locations
        locations = []
        if parsed.get('locations'):
            for loc_str in parsed['locations'].split('|'):
                loc_str = loc_str.strip()
                if loc_str and loc_str != 'N/A':
                    parts = loc_str.split(',')
                    if len(parts) >= 2:
                        try:
                            lat = float(parts[0].strip())
                            lng = float(parts[1].strip())
                            address = ','.join(parts[2:]).strip() if len(parts) > 2 else None
                            locations.append(Location(latitude=lat, longitude=lng, address=address))
                        except:
                            # If can't parse coordinates, create with default UK location
                            locations.append(Location(latitude=51.5074, longitude=-0.1278, address=loc_str))
        
        # Build report
        report = AIGeneratedReport(
            raw_input=request.raw_text,
            input_type="text",
            title=parsed.get('title', 'Untitled Report'),
            summary=parsed.get('summary', ''),
            detailed_description=parsed.get('detailed_description', request.raw_text),
            category=parsed.get('category', 'Other'),
            haunting_type=parsed.get('haunting_type') if parsed.get('haunting_type') != 'N/A' else None,
            locations=locations,
            dates_mentioned=[d.strip() for d in parsed.get('dates', '').split('|') if d.strip() and d.strip() != 'N/A'],
            witnesses_mentioned=int(parsed.get('witnesses', '1').split()[0]) if parsed.get('witnesses', '').split() else 1,
            entities_described=[e.strip() for e in parsed.get('entities', '').split('|') if e.strip() and e.strip() != 'N/A'],
            credibility_assessment=parsed.get('credibility', 'Medium - Requires investigation'),
            severity_assessment=parsed.get('severity') if parsed.get('severity') != 'N/A' else None,
            key_evidence=[e.strip() for e in parsed.get('key_evidence', '').split('|') if e.strip()],
            investigation_recommendations=[r.strip() for r in parsed.get('recommendations', '').split('|') if r.strip()],
            similar_cases=[c.strip() for c in parsed.get('similar_cases', '').split('|') if c.strip()],
            suggested_images=[],
            audio_transcriptions=[]
        )
        
        # Save to database
        doc = report.model_dump()
        doc['generated_at'] = doc['generated_at'].isoformat()
        await db.ai_reports.insert_one(doc)
        
        return report
        
    except Exception as e:
        logger.error(f"AI report generation failed: {e}")
        # Return a basic report
        return AIGeneratedReport(
            raw_input=request.raw_text,
            input_type="text",
            title="Report from Submitted Information",
            summary="AI analysis unavailable. Please review the raw input below.",
            detailed_description=request.raw_text,
            category="Other",
            credibility_assessment="Unable to assess - manual review required",
            locations=[],
            dates_mentioned=[],
            witnesses_mentioned=1,
            entities_described=[],
            key_evidence=[],
            investigation_recommendations=["Review the submitted information manually", "Contact witnesses if possible", "Document any additional details"],
            similar_cases=[]
        )

@api_router.post("/ai/generate-report/convert-to-sighting")
async def convert_ai_report_to_sighting(report_id: str):
    """Convert an AI-generated report into a formal sighting submission"""
    report = await db.ai_reports.find_one({"id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Create sighting from report
    location = report['locations'][0] if report.get('locations') else {"latitude": 51.5074, "longitude": -0.1278}
    
    sighting_data = SightingCreate(
        title=report['title'],
        description=report['detailed_description'],
        category=report['category'],
        location=Location(**location) if isinstance(location, dict) else location,
        date_occurred=datetime.now(timezone.utc),
        witness_count=report.get('witnesses_mentioned', 1)
    )
    
    # Create the sighting
    sighting = Sighting(**sighting_data.model_dump())
    sighting.ai_analysis = await perform_ai_analysis(sighting)
    
    doc = sighting.model_dump()
    for key in ['date_occurred', 'created_at', 'updated_at']:
        doc[key] = doc[key].isoformat()
    if doc['ai_analysis']:
        doc['ai_analysis']['timestamp'] = doc['ai_analysis']['timestamp'].isoformat()
    
    await db.sightings.insert_one(doc)
    return {"message": "Sighting created from report", "sighting_id": sighting.id}

@api_router.post("/ai/generate-report/convert-to-haunting")
async def convert_ai_report_to_haunting(report_id: str, reporter_name: str, reporter_email: str):
    """Convert an AI-generated report into a formal haunting submission"""
    report = await db.ai_reports.find_one({"id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    location = report['locations'][0] if report.get('locations') else {"latitude": 51.5074, "longitude": -0.1278}
    
    haunting_data = HauntingReportCreate(
        property_type="Other",
        location=Location(**location) if isinstance(location, dict) else location,
        haunting_type=report.get('haunting_type') or "Other",
        activity_description=report['detailed_description'],
        frequency="Occasional",
        duration_months=1,
        witnesses=report.get('witnesses_mentioned', 1),
        reporter_name=reporter_name,
        reporter_email=reporter_email,
        visibility="subscribers",
        seeking_help=True
    )
    
    haunting = HauntingReport(**haunting_data.model_dump())
    haunting.severity_assessment = await perform_haunting_severity_assessment(haunting_data)
    
    doc = haunting.model_dump()
    for key in ['created_at', 'updated_at']:
        doc[key] = doc[key].isoformat()
    if doc['severity_assessment']:
        doc['severity_assessment']['timestamp'] = doc['severity_assessment']['timestamp'].isoformat()
    
    await db.haunting_reports.insert_one(doc)
    return {"message": "Haunting report created from AI report", "haunting_id": haunting.id}

@api_router.get("/ai/reports")
async def get_ai_reports(limit: int = 20, skip: int = 0):
    """Get previously generated AI reports"""
    cursor = db.ai_reports.find({}, {"_id": 0}).skip(skip).limit(limit).sort("generated_at", -1)
    reports = await cursor.to_list(limit)
    return {"reports": [convert_doc_dates(r) for r in reports], "count": len(reports)}

@api_router.get("/ai/reports/{report_id}")
async def get_ai_report(report_id: str):
    report = await db.ai_reports.find_one({"id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return convert_doc_dates(report)

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
