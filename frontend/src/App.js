import { useState, useEffect, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Toaster, toast } from 'sonner';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Custom marker icons
const createIcon = (color) => new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const categoryIcons = {
  'Ghost/Spirit': createIcon('violet'),
  'UFO/UAP': createIcon('green'),
  'Cryptid': createIcon('orange'),
  'Poltergeist': createIcon('red'),
  'Shadow Figure': createIcon('black'),
  'Orb': createIcon('yellow'),
  'EVP/Audio': createIcon('blue'),
  'Unexplained Phenomenon': createIcon('grey'),
  'Other': createIcon('gold')
};

// Components
const Navbar = () => {
  return (
    <nav className="bg-gray-900 border-b border-purple-500/30 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2" data-testid="nav-logo">
            <span className="text-2xl">👻</span>
            <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
              ParaInvestigate
            </span>
          </Link>
          <div className="flex items-center space-x-4">
            <Link 
              to="/" 
              className="text-gray-300 hover:text-purple-400 transition px-3 py-2"
              data-testid="nav-home"
            >
              Home
            </Link>
            <Link 
              to="/map" 
              className="text-gray-300 hover:text-purple-400 transition px-3 py-2"
              data-testid="nav-map"
            >
              Map View
            </Link>
            <Link 
              to="/report" 
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition"
              data-testid="nav-report"
            >
              Report Sighting
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

const CategoryBadge = ({ category }) => {
  const colors = {
    'Ghost/Spirit': 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    'UFO/UAP': 'bg-green-500/20 text-green-300 border-green-500/30',
    'Cryptid': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    'Poltergeist': 'bg-red-500/20 text-red-300 border-red-500/30',
    'Shadow Figure': 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    'Orb': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    'EVP/Audio': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'Unexplained Phenomenon': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    'Other': 'bg-amber-500/20 text-amber-300 border-amber-500/30'
  };
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs border ${colors[category] || colors['Other']}`}>
      {category}
    </span>
  );
};

const CredibilityScore = ({ score }) => {
  const getColor = () => {
    if (score >= 70) return 'text-green-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };
  
  return (
    <div className="flex items-center space-x-2">
      <div className="w-16 bg-gray-700 rounded-full h-2">
        <div 
          className={`h-2 rounded-full ${score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-sm font-semibold ${getColor()}`}>{score}%</span>
    </div>
  );
};

const StarRating = ({ rating, onRate, interactive = false }) => {
  const [hover, setHover] = useState(0);
  
  return (
    <div className="flex space-x-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`text-2xl transition ${
            interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'
          } ${(hover || rating) >= star ? 'text-yellow-400' : 'text-gray-600'}`}
          onClick={() => interactive && onRate && onRate(star)}
          onMouseEnter={() => interactive && setHover(star)}
          onMouseLeave={() => interactive && setHover(0)}
          disabled={!interactive}
          data-testid={`star-${star}`}
        >
          ★
        </button>
      ))}
    </div>
  );
};

const SightingCard = ({ sighting, onClick }) => {
  const avgRating = sighting.ratings?.length > 0
    ? sighting.ratings.reduce((sum, r) => sum + r.score, 0) / sighting.ratings.length
    : 0;

  return (
    <div 
      className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-4 hover:border-purple-500/50 transition cursor-pointer"
      onClick={onClick}
      data-testid={`sighting-card-${sighting.id}`}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-semibold text-white truncate flex-1 mr-2">{sighting.title}</h3>
        {sighting.verified && (
          <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full border border-green-500/30">
            ✓ Verified
          </span>
        )}
      </div>
      
      <div className="flex items-center space-x-2 mb-2">
        <CategoryBadge category={sighting.category} />
        <span className="text-gray-400 text-sm">
          {new Date(sighting.date_occurred).toLocaleDateString()}
        </span>
      </div>
      
      <p className="text-gray-400 text-sm mb-3 line-clamp-2">{sighting.description}</p>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-gray-500 text-xs">AI Score:</span>
          {sighting.ai_analysis && (
            <CredibilityScore score={sighting.ai_analysis.credibility_score} />
          )}
        </div>
        <div className="flex items-center space-x-1">
          <StarRating rating={Math.round(avgRating)} />
          <span className="text-gray-500 text-xs">({sighting.ratings?.length || 0})</span>
        </div>
      </div>
    </div>
  );
};

// Location Picker Component
const LocationPicker = ({ onLocationSelect, initialPosition }) => {
  const [position, setPosition] = useState(initialPosition || null);
  
  const LocationMarker = () => {
    useMapEvents({
      click(e) {
        setPosition(e.latlng);
        onLocationSelect(e.latlng);
      },
    });
    
    return position ? (
      <Marker position={position}>
        <Popup>Selected location</Popup>
      </Marker>
    ) : null;
  };
  
  return (
    <MapContainer
      center={initialPosition || [39.8283, -98.5795]}
      zoom={4}
      style={{ height: '300px', width: '100%' }}
      className="rounded-lg"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      <LocationMarker />
    </MapContainer>
  );
};

// Pages
const HomePage = () => {
  const [sightings, setSightings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sightingsRes, statsRes, categoriesRes] = await Promise.all([
          axios.get(`${API}/sightings`),
          axios.get(`${API}/stats`),
          axios.get(`${API}/categories`)
        ]);
        setSightings(sightingsRes.data);
        setStats(statsRes.data);
        setCategories(categoriesRes.data.categories);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load sightings');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredSightings = filter
    ? sightings.filter(s => s.category === filter)
    : sightings;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-purple-900/50 to-gray-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4" data-testid="hero-title">
            Paranormal Investigation Hub
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Report, explore, and investigate unexplained phenomena. Join our community of truth seekers.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/report"
              className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg text-lg font-semibold transition"
              data-testid="hero-report-btn"
            >
              Report a Sighting
            </Link>
            <Link
              to="/map"
              className="bg-gray-700 hover:bg-gray-600 text-white px-8 py-3 rounded-lg text-lg font-semibold transition"
              data-testid="hero-map-btn"
            >
              View Map
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      {stats && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/80 backdrop-blur border border-purple-500/20 rounded-xl p-4 text-center" data-testid="stat-total">
              <div className="text-3xl font-bold text-purple-400">{stats.total_sightings}</div>
              <div className="text-gray-400 text-sm">Total Sightings</div>
            </div>
            <div className="bg-gray-800/80 backdrop-blur border border-green-500/20 rounded-xl p-4 text-center" data-testid="stat-verified">
              <div className="text-3xl font-bold text-green-400">{stats.verified_sightings}</div>
              <div className="text-gray-400 text-sm">Verified Cases</div>
            </div>
            <div className="bg-gray-800/80 backdrop-blur border border-blue-500/20 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-blue-400">{Object.keys(stats.categories || {}).length}</div>
              <div className="text-gray-400 text-sm">Categories</div>
            </div>
            <div className="bg-gray-800/80 backdrop-blur border border-yellow-500/20 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-yellow-400">24/7</div>
              <div className="text-gray-400 text-sm">Active Monitoring</div>
            </div>
          </div>
        </div>
      )}

      {/* Sightings List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
          <h2 className="text-2xl font-bold text-white">Recent Sightings</h2>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-4 py-2"
            data-testid="category-filter"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
          </div>
        ) : filteredSightings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No sightings reported yet. Be the first to report!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="sightings-grid">
            {filteredSightings.map(sighting => (
              <SightingCard
                key={sighting.id}
                sighting={sighting}
                onClick={() => navigate(`/sighting/${sighting.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const MapPage = () => {
  const [sightings, setSightings] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [nearbySightings, setNearbySightings] = useState([]);
  const [searchRadius, setSearchRadius] = useState(50);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSightings = async () => {
      try {
        const response = await axios.get(`${API}/sightings`);
        setSightings(response.data);
      } catch (error) {
        toast.error('Failed to load sightings');
      } finally {
        setLoading(false);
      }
    };
    fetchSightings();
  }, []);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Geolocation not available:', error);
        }
      );
    }
  }, []);

  const checkNearbySightings = async () => {
    if (!userLocation) {
      toast.error('Enable location to find nearby sightings');
      return;
    }
    
    try {
      const response = await axios.post(`${API}/sightings/nearby`, {
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        radius_km: searchRadius
      });
      setNearbySightings(response.data.sightings);
      if (response.data.count > 0) {
        toast.success(`Found ${response.data.count} sightings within ${searchRadius}km!`);
      } else {
        toast.info('No sightings found in this area');
      }
    } catch (error) {
      toast.error('Failed to search nearby sightings');
    }
  };

  const RecenterMap = ({ center }) => {
    const map = useMap();
    useEffect(() => {
      if (center) {
        map.setView(center, 10);
      }
    }, [center, map]);
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
          <h1 className="text-2xl font-bold text-white" data-testid="map-title">Sighting Map</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-gray-400 text-sm">Radius:</label>
              <select
                value={searchRadius}
                onChange={(e) => setSearchRadius(Number(e.target.value))}
                className="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2"
                data-testid="radius-select"
              >
                <option value={10}>10 km</option>
                <option value={25}>25 km</option>
                <option value={50}>50 km</option>
                <option value={100}>100 km</option>
                <option value={250}>250 km</option>
              </select>
            </div>
            <button
              onClick={checkNearbySightings}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition"
              data-testid="nearby-btn"
            >
              🔔 Find Nearby
            </button>
          </div>
        </div>

        {/* Nearby Notifications */}
        {nearbySightings.length > 0 && (
          <div className="bg-purple-900/30 border border-purple-500/30 rounded-xl p-4 mb-6" data-testid="nearby-panel">
            <h3 className="text-lg font-semibold text-purple-300 mb-3">🔔 Nearby Sightings</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {nearbySightings.map(s => (
                <div 
                  key={s.id}
                  className="flex items-center justify-between bg-gray-800/50 rounded-lg p-2 cursor-pointer hover:bg-gray-700/50"
                  onClick={() => navigate(`/sighting/${s.id}`)}
                >
                  <div>
                    <span className="text-white">{s.title}</span>
                    <span className="text-gray-400 text-sm ml-2">({s.category})</span>
                  </div>
                  <span className="text-purple-400 text-sm">{s.distance_km} km away</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Map */}
        <div className="bg-gray-800/50 rounded-xl overflow-hidden border border-purple-500/20" style={{ height: '600px' }}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <MapContainer
              center={userLocation || [39.8283, -98.5795]}
              zoom={userLocation ? 10 : 4}
              style={{ height: '100%', width: '100%' }}
              data-testid="map-container"
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; OpenStreetMap contributors &copy; CARTO'
              />
              {userLocation && <RecenterMap center={userLocation} />}
              
              {/* User location marker */}
              {userLocation && (
                <Marker 
                  position={userLocation}
                  icon={new L.DivIcon({
                    className: 'custom-marker',
                    html: '<div style="background: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white;"></div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                  })}
                >
                  <Popup>Your Location</Popup>
                </Marker>
              )}
              
              {/* Sighting markers */}
              {sightings.map(sighting => (
                <Marker
                  key={sighting.id}
                  position={[sighting.location.latitude, sighting.location.longitude]}
                  icon={categoryIcons[sighting.category] || categoryIcons['Other']}
                >
                  <Popup>
                    <div className="min-w-[200px]">
                      <h3 className="font-semibold text-gray-900">{sighting.title}</h3>
                      <p className="text-xs text-gray-600 mt-1">{sighting.category}</p>
                      <p className="text-sm text-gray-700 mt-2 line-clamp-2">{sighting.description}</p>
                      <button
                        onClick={() => navigate(`/sighting/${sighting.id}`)}
                        className="mt-2 text-purple-600 hover:text-purple-800 text-sm font-medium"
                      >
                        View Details →
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </div>

        {/* Legend */}
        <div className="mt-4 bg-gray-800/50 rounded-xl p-4 border border-purple-500/20">
          <h3 className="text-white font-semibold mb-3">Legend</h3>
          <div className="flex flex-wrap gap-4">
            {Object.entries(categoryIcons).map(([category]) => (
              <div key={category} className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full" style={{
                  backgroundColor: category === 'Ghost/Spirit' ? '#8b5cf6' :
                    category === 'UFO/UAP' ? '#22c55e' :
                    category === 'Cryptid' ? '#f97316' :
                    category === 'Poltergeist' ? '#ef4444' :
                    category === 'Shadow Figure' ? '#374151' :
                    category === 'Orb' ? '#eab308' :
                    category === 'EVP/Audio' ? '#3b82f6' :
                    category === 'Unexplained Phenomenon' ? '#6b7280' : '#d97706'
                }}></span>
                <span className="text-gray-400 text-sm">{category}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ReportPage = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    date_occurred: '',
    witness_count: 1,
    reporter_name: '',
    reporter_email: '',
    evidence_photos: []
  });
  const [location, setLocation] = useState(null);
  const [categories, setCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axios.get(`${API}/categories`);
        setCategories(response.data.categories);
      } catch (error) {
        toast.error('Failed to load categories');
      }
    };
    fetchCategories();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!location) {
      toast.error('Please select a location on the map');
      return;
    }
    
    if (!formData.category) {
      toast.error('Please select a category');
      return;
    }

    setSubmitting(true);
    
    try {
      const payload = {
        ...formData,
        date_occurred: new Date(formData.date_occurred).toISOString(),
        location: {
          latitude: location.lat,
          longitude: location.lng
        }
      };
      
      const response = await axios.post(`${API}/sightings`, payload);
      toast.success('Sighting reported successfully! AI analysis complete.');
      navigate(`/sighting/${response.data.id}`);
    } catch (error) {
      toast.error('Failed to submit report. Please try again.');
      console.error('Submit error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          evidence_photos: [...prev.evidence_photos, reader.result]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white mb-8" data-testid="report-title">Report a Sighting</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-gray-300 mb-2">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 focus:border-purple-500 focus:outline-none"
              placeholder="Brief title for your sighting"
              required
              data-testid="input-title"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-gray-300 mb-2">Category *</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 focus:border-purple-500 focus:outline-none"
              required
              data-testid="select-category"
            >
              <option value="">Select a category</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-gray-300 mb-2">Description *</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 focus:border-purple-500 focus:outline-none min-h-[150px]"
              placeholder="Describe what you witnessed in detail..."
              required
              data-testid="input-description"
            />
          </div>

          {/* Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-300 mb-2">Date of Occurrence *</label>
              <input
                type="datetime-local"
                value={formData.date_occurred}
                onChange={(e) => setFormData({ ...formData, date_occurred: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 focus:border-purple-500 focus:outline-none"
                required
                data-testid="input-date"
              />
            </div>
            <div>
              <label className="block text-gray-300 mb-2">Number of Witnesses</label>
              <input
                type="number"
                min="1"
                value={formData.witness_count}
                onChange={(e) => setFormData({ ...formData, witness_count: parseInt(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 focus:border-purple-500 focus:outline-none"
                data-testid="input-witnesses"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-gray-300 mb-2">Location * (Click on map to select)</label>
            <LocationPicker onLocationSelect={setLocation} />
            {location && (
              <p className="text-gray-400 text-sm mt-2">
                Selected: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </p>
            )}
          </div>

          {/* Evidence Photos */}
          <div>
            <label className="block text-gray-300 mb-2">Evidence Photos (Optional)</label>
            <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
                id="photo-upload"
                data-testid="input-photos"
              />
              <label htmlFor="photo-upload" className="cursor-pointer">
                <div className="text-gray-400">
                  <span className="text-4xl">📷</span>
                  <p className="mt-2">Click to upload photos</p>
                </div>
              </label>
            </div>
            {formData.evidence_photos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {formData.evidence_photos.map((photo, index) => (
                  <div key={index} className="relative">
                    <img src={photo} alt={`Evidence ${index + 1}`} className="w-20 h-20 object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        evidence_photos: prev.evidence_photos.filter((_, i) => i !== index)
                      }))}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reporter Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-300 mb-2">Your Name (Optional)</label>
              <input
                type="text"
                value={formData.reporter_name}
                onChange={(e) => setFormData({ ...formData, reporter_name: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 focus:border-purple-500 focus:outline-none"
                placeholder="Anonymous"
                data-testid="input-name"
              />
            </div>
            <div>
              <label className="block text-gray-300 mb-2">Email (Optional)</label>
              <input
                type="email"
                value={formData.reporter_email}
                onChange={(e) => setFormData({ ...formData, reporter_email: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 focus:border-purple-500 focus:outline-none"
                placeholder="For follow-up questions"
                data-testid="input-email"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white py-4 rounded-lg font-semibold text-lg transition"
            data-testid="submit-btn"
          >
            {submitting ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Analyzing & Submitting...
              </span>
            ) : (
              'Submit Report'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

const SightingDetailPage = () => {
  const { id } = useParams();
  const [sighting, setSighting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchSighting = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/sightings/${id}`);
      setSighting(response.data);
    } catch (error) {
      toast.error('Failed to load sighting');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSighting();
  }, [fetchSighting]);

  const handleRatingSubmit = async () => {
    if (ratingScore === 0) {
      toast.error('Please select a rating');
      return;
    }
    
    setSubmittingRating(true);
    try {
      await axios.post(`${API}/sightings/${id}/rate`, {
        user_id: `user_${Math.random().toString(36).substr(2, 9)}`,
        score: ratingScore,
        comment: ratingComment
      });
      toast.success('Rating submitted!');
      setRatingScore(0);
      setRatingComment('');
      fetchSighting();
    } catch (error) {
      toast.error('Failed to submit rating');
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleReanalyze = async () => {
    setAnalyzing(true);
    try {
      await axios.post(`${API}/sightings/${id}/analyze`);
      toast.success('AI analysis updated!');
      fetchSighting();
    } catch (error) {
      toast.error('Failed to reanalyze');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!sighting) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400">Sighting not found</p>
      </div>
    );
  }

  const avgRating = sighting.ratings?.length > 0
    ? sighting.ratings.reduce((sum, r) => sum + r.score, 0) / sighting.ratings.length
    : 0;

  return (
    <div className="min-h-screen bg-gray-900 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2" data-testid="sighting-title">{sighting.title}</h1>
            <div className="flex items-center space-x-3">
              <CategoryBadge category={sighting.category} />
              {sighting.verified && (
                <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full border border-green-500/30">
                  ✓ Verified
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Description</h2>
              <p className="text-gray-300 whitespace-pre-wrap" data-testid="sighting-description">{sighting.description}</p>
            </div>

            {/* Evidence Photos */}
            {sighting.evidence_photos?.length > 0 && (
              <div className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Evidence Photos</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {sighting.evidence_photos.map((photo, index) => (
                    <img key={index} src={photo} alt={`Evidence ${index + 1}`} className="rounded-lg w-full h-32 object-cover" />
                  ))}
                </div>
              </div>
            )}

            {/* Location Map */}
            <div className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Location</h2>
              <div style={{ height: '300px' }} className="rounded-lg overflow-hidden">
                <MapContainer
                  center={[sighting.location.latitude, sighting.location.longitude]}
                  zoom={12}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; OpenStreetMap contributors'
                  />
                  <Marker position={[sighting.location.latitude, sighting.location.longitude]}>
                    <Popup>{sighting.title}</Popup>
                  </Marker>
                </MapContainer>
              </div>
            </div>

            {/* AI Analysis */}
            {sighting.ai_analysis && (
              <div className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-6" data-testid="ai-analysis">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">🤖 AI Analysis</h2>
                  <button
                    onClick={handleReanalyze}
                    disabled={analyzing}
                    className="text-purple-400 hover:text-purple-300 text-sm"
                  >
                    {analyzing ? 'Analyzing...' : '🔄 Re-analyze'}
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <span className="text-gray-400 text-sm">Credibility Score</span>
                    <div className="flex items-center space-x-3 mt-1">
                      <div className="flex-1 bg-gray-700 rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full transition-all ${
                            sighting.ai_analysis.credibility_score >= 70 ? 'bg-green-500' :
                            sighting.ai_analysis.credibility_score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${sighting.ai_analysis.credibility_score}%` }}
                        />
                      </div>
                      <span className="text-white font-semibold">{sighting.ai_analysis.credibility_score}%</span>
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-gray-400 text-sm">Analysis Summary</span>
                    <p className="text-gray-300 mt-1">{sighting.ai_analysis.analysis_summary}</p>
                  </div>
                  
                  {sighting.ai_analysis.similar_cases?.length > 0 && (
                    <div>
                      <span className="text-gray-400 text-sm">Similar Cases</span>
                      <ul className="mt-1 space-y-1">
                        {sighting.ai_analysis.similar_cases.map((c, i) => (
                          <li key={i} className="text-gray-300 text-sm flex items-start">
                            <span className="text-purple-400 mr-2">•</span> {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {sighting.ai_analysis.suggested_investigation_steps?.length > 0 && (
                    <div>
                      <span className="text-gray-400 text-sm">Suggested Investigation Steps</span>
                      <ol className="mt-1 space-y-1">
                        {sighting.ai_analysis.suggested_investigation_steps.map((step, i) => (
                          <li key={i} className="text-gray-300 text-sm flex items-start">
                            <span className="text-purple-400 mr-2">{i + 1}.</span> {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Meta & Ratings */}
          <div className="space-y-6">
            {/* Meta Info */}
            <div className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Details</h2>
              <div className="space-y-3">
                <div>
                  <span className="text-gray-400 text-sm">Date Occurred</span>
                  <p className="text-white">{new Date(sighting.date_occurred).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">Witnesses</span>
                  <p className="text-white">{sighting.witness_count}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">Reported</span>
                  <p className="text-white">{new Date(sighting.created_at).toLocaleDateString()}</p>
                </div>
                {sighting.reporter_name && (
                  <div>
                    <span className="text-gray-400 text-sm">Reporter</span>
                    <p className="text-white">{sighting.reporter_name}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Community Rating */}
            <div className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Community Rating</h2>
              <div className="text-center mb-4">
                <div className="text-4xl font-bold text-yellow-400">{avgRating.toFixed(1)}</div>
                <StarRating rating={Math.round(avgRating)} />
                <p className="text-gray-400 text-sm mt-1">{sighting.ratings?.length || 0} ratings</p>
              </div>
              
              {/* Add Rating */}
              <div className="border-t border-gray-700 pt-4 mt-4">
                <p className="text-gray-300 text-sm mb-2">Rate this sighting:</p>
                <div className="flex justify-center mb-3">
                  <StarRating rating={ratingScore} onRate={setRatingScore} interactive />
                </div>
                <textarea
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                  placeholder="Add a comment (optional)"
                  rows={2}
                  data-testid="rating-comment"
                />
                <button
                  onClick={handleRatingSubmit}
                  disabled={submittingRating || ratingScore === 0}
                  className="w-full mt-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-2 rounded-lg text-sm transition"
                  data-testid="submit-rating-btn"
                >
                  {submittingRating ? 'Submitting...' : 'Submit Rating'}
                </button>
              </div>
            </div>

            {/* Recent Ratings */}
            {sighting.ratings?.length > 0 && (
              <div className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Recent Reviews</h2>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {sighting.ratings.slice(-5).reverse().map((rating, index) => (
                    <div key={index} className="bg-gray-700/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <StarRating rating={rating.score} />
                        <span className="text-gray-500 text-xs">
                          {new Date(rating.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      {rating.comment && (
                        <p className="text-gray-300 text-sm">{rating.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/sighting/:id" element={<SightingDetailPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
