import { useState, useEffect, useCallback, createContext, useContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Toaster, toast } from 'sonner';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context (simplified - in production use proper auth)
const AuthContext = createContext(null);

const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('paraUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    if (user) {
      checkSubscription(user.id);
    }
  }, [user]);

  const checkSubscription = async (userId) => {
    try {
      const response = await axios.get(`${API}/subscription/check/${userId}`);
      setSubscription(response.data);
    } catch (error) {
      console.error('Subscription check failed:', error);
    }
  };

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('paraUser', JSON.stringify(userData));
    checkSubscription(userData.id);
  };

  const logout = () => {
    setUser(null);
    setSubscription(null);
    localStorage.removeItem('paraUser');
  };

  return (
    <AuthContext.Provider value={{ user, subscription, login, logout, isSubscriber: subscription?.is_subscriber }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom icons
const createIcon = (color) => new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const severityColors = {
  'Low': 'bg-green-500', 'Moderate': 'bg-yellow-500', 'High': 'bg-orange-500',
  'Severe': 'bg-red-500', 'Critical': 'bg-red-700'
};

// ============== COMPONENTS ==============

const Navbar = () => {
  const { user, logout, isSubscriber } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          
          <div className="hidden md:flex items-center space-x-1">
            <Link to="/" className="text-gray-300 hover:text-purple-400 px-3 py-2 text-sm">Home</Link>
            <Link to="/sightings" className="text-gray-300 hover:text-purple-400 px-3 py-2 text-sm">Sightings</Link>
            <Link to="/hauntings" className="text-gray-300 hover:text-purple-400 px-3 py-2 text-sm">Hauntings</Link>
            <Link to="/investigators" className="text-gray-300 hover:text-purple-400 px-3 py-2 text-sm">Investigators</Link>
            <Link to="/equipment" className="text-gray-300 hover:text-purple-400 px-3 py-2 text-sm">Equipment</Link>
            <Link to="/ai-report" className="text-gray-300 hover:text-purple-400 px-3 py-2 text-sm">🤖 AI</Link>
            <Link to="/map" className="text-gray-300 hover:text-purple-400 px-3 py-2 text-sm">Map</Link>
            <Link to="/advertise" className="text-yellow-400 hover:text-yellow-300 px-3 py-2 text-sm">📺 Advertise</Link>
            
            {!isSubscriber && (
              <Link to="/pricing" className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg text-sm font-semibold ml-2">
                Subscribe
              </Link>
            )}
            
            {user ? (
              <div className="flex items-center space-x-2 ml-2">
                <Link to="/dashboard" className="text-purple-400 hover:text-purple-300 px-3 py-2 text-sm">Dashboard</Link>
                <button onClick={logout} className="text-gray-400 hover:text-white text-sm">Logout</button>
              </div>
            ) : (
              <Link to="/login" className="text-gray-300 hover:text-white px-3 py-2 text-sm">Login</Link>
            )}
          </div>

          <button className="md:hidden text-gray-300" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            <Link to="/" className="block text-gray-300 hover:text-purple-400 px-3 py-2">Home</Link>
            <Link to="/sightings" className="block text-gray-300 hover:text-purple-400 px-3 py-2">Sightings</Link>
            <Link to="/hauntings" className="block text-gray-300 hover:text-purple-400 px-3 py-2">Hauntings</Link>
            <Link to="/investigators" className="block text-gray-300 hover:text-purple-400 px-3 py-2">Investigators</Link>
            <Link to="/equipment" className="block text-gray-300 hover:text-purple-400 px-3 py-2">Equipment</Link>
            <Link to="/pricing" className="block text-purple-400 hover:text-purple-300 px-3 py-2">Subscribe</Link>
          </div>
        )}
      </div>
    </nav>
  );
};

const SeverityBadge = ({ severity }) => (
  <span className={`px-2 py-1 rounded-full text-xs text-white ${severityColors[severity] || 'bg-gray-500'}`}>
    {severity}
  </span>
);

const StarRating = ({ rating, onRate, interactive = false, size = "text-xl" }) => {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`${size} transition ${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} ${(hover || rating) >= star ? 'text-yellow-400' : 'text-gray-600'}`}
          onClick={() => interactive && onRate?.(star)}
          onMouseEnter={() => interactive && setHover(star)}
          onMouseLeave={() => interactive && setHover(0)}
          disabled={!interactive}
        >★</button>
      ))}
    </div>
  );
};

const LocationPicker = ({ onLocationSelect, initialPosition }) => {
  const [position, setPosition] = useState(initialPosition || null);
  const LocationMarker = () => {
    useMapEvents({
      click(e) { setPosition(e.latlng); onLocationSelect(e.latlng); },
    });
    return position ? <Marker position={position}><Popup>Selected location</Popup></Marker> : null;
  };
  return (
    <MapContainer center={initialPosition || [51.5074, -0.1278]} zoom={6} style={{ height: '250px', width: '100%' }} className="rounded-lg">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <LocationMarker />
    </MapContainer>
  );
};

const SubscriberGate = ({ children, message = "Subscribe to access this content" }) => {
  const { isSubscriber } = useAuth();
  if (isSubscriber) return children;
  return (
    <div className="bg-gray-800/50 border border-purple-500/30 rounded-xl p-8 text-center">
      <div className="text-4xl mb-4">🔒</div>
      <h3 className="text-xl font-bold text-white mb-2">Subscribers Only</h3>
      <p className="text-gray-400 mb-4">{message}</p>
      <Link to="/pricing" className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg inline-block">
        Subscribe Now - £9.99/month
      </Link>
    </div>
  );
};

// ============== PAGES ==============

const HomePage = () => {
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${API}/stats`).then(res => setStats(res.data)).catch(console.error);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-purple-900/50 to-gray-900 py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Paranormal Investigation Hub
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Report sightings, get AI-powered analysis, connect with professional investigators, and explore the unknown. Join the UK's premier paranormal community.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/hauntings/report" className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg text-lg font-semibold">
              🏚️ Report a Haunting
            </Link>
            <Link to="/sightings/report" className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg text-lg font-semibold">
              👁️ Report Sighting
            </Link>
            <Link to="/investigators" className="bg-gray-700 hover:bg-gray-600 text-white px-8 py-3 rounded-lg text-lg font-semibold">
              🔍 Find Investigator
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="max-w-7xl mx-auto px-4 -mt-10">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { value: stats.total_sightings, label: "Sightings", color: "purple" },
              { value: stats.haunting_reports, label: "Haunting Cases", color: "red" },
              { value: stats.active_investigators, label: "Investigators", color: "green" },
              { value: stats.equipment_reviews, label: "Equipment Reviews", color: "blue" },
              { value: stats.verified_sightings, label: "Verified", color: "yellow" },
            ].map((stat, i) => (
              <div key={i} className={`bg-gray-800/80 backdrop-blur border border-${stat.color}-500/20 rounded-xl p-4 text-center`}>
                <div className={`text-3xl font-bold text-${stat.color}-400`}>{stat.value}</div>
                <div className="text-gray-400 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-white text-center mb-12">What We Offer</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: "🏚️", title: "Haunting Reports", desc: "Report paranormal activity at your property. Get AI severity assessment and connect with investigators.", link: "/hauntings" },
            { icon: "👁️", title: "Sighting Database", desc: "Browse and report paranormal sightings. View on map, rate credibility, get AI analysis.", link: "/sightings" },
            { icon: "🔍", title: "Find Investigators", desc: "Connect with professional paranormal investigators in your area. Book investigations.", link: "/investigators" },
            { icon: "🛠️", title: "Equipment Reviews", desc: "Discover and review ghost hunting equipment. Get recommendations from experts.", link: "/equipment" },
            { icon: "🗺️", title: "Interactive Map", desc: "Explore all sightings and haunting reports on our interactive map. Find activity near you.", link: "/map" },
            { icon: "🤖", title: "AI Analysis", desc: "Advanced AI analysis of reports including severity assessment, credibility scoring, and pattern recognition.", link: "/pricing" },
          ].map((feature, i) => (
            <div key={i} onClick={() => navigate(feature.link)} className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-6 hover:border-purple-500/50 transition cursor-pointer">
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-gray-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Are You a Paranormal Investigator?</h2>
          <p className="text-gray-300 mb-6">List your services, receive bookings, and connect with people who need your expertise.</p>
          <Link to="/investigators/register" className="bg-white text-purple-900 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100">
            Register as Investigator - £20/month
          </Link>
        </div>
      </div>
    </div>
  );
};

const SightingsPage = () => {
  const [sightings, setSightings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/sightings`),
      axios.get(`${API}/categories`)
    ]).then(([sightingsRes, categoriesRes]) => {
      setSightings(sightingsRes.data);
      setCategories(categoriesRes.data.categories);
    }).finally(() => setLoading(false));
  }, []);

  const filteredSightings = filter ? sightings.filter(s => s.category === filter) : sightings;

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-wrap items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Paranormal Sightings</h1>
            <p className="text-gray-400">Browse and explore reported sightings</p>
          </div>
          <div className="flex gap-4">
            <select value={filter} onChange={e => setFilter(e.target.value)} className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2">
              <option value="">All Categories</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <Link to="/sightings/report" className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg">
              + Report Sighting
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div></div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSightings.map(sighting => (
              <div key={sighting.id} onClick={() => navigate(`/sighting/${sighting.id}`)} className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-5 hover:border-purple-500/50 cursor-pointer">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold text-white">{sighting.title}</h3>
                  {sighting.verified && <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full">✓ Verified</span>}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full text-xs">{sighting.category}</span>
                  <span className="text-gray-500 text-sm">{new Date(sighting.date_occurred).toLocaleDateString()}</span>
                </div>
                <p className="text-gray-400 text-sm mb-3 line-clamp-2">{sighting.description}</p>
                {sighting.ai_analysis && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">AI Score: {sighting.ai_analysis.credibility_score}%</span>
                    <StarRating rating={Math.round(sighting.ratings?.reduce((a, r) => a + r.score, 0) / (sighting.ratings?.length || 1))} size="text-sm" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const HauntingsPage = () => {
  const { isSubscriber } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${API}/hauntings?is_subscriber=${isSubscriber ? 'true' : 'false'}`).then(res => setReports(res.data.reports)).finally(() => setLoading(false));
  }, [isSubscriber]);

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-wrap items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Haunting Reports</h1>
            <p className="text-gray-400">Properties experiencing paranormal activity</p>
          </div>
          <Link to="/hauntings/report" className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg">
            🏚️ Report Haunting
          </Link>
        </div>

        {!isSubscriber && (
          <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">🔒 Subscribe for Full Access</h3>
                <p className="text-gray-300">View detailed reports, contact investigators, and access AI analysis.</p>
              </div>
              <Link to="/pricing" className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg whitespace-nowrap">
                £9.99/month
              </Link>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div></div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reports.map(report => (
              <div key={report.id} onClick={() => navigate(`/haunting/${report.id}`)} className="bg-gray-800/50 border border-red-500/20 rounded-xl p-5 hover:border-red-500/50 cursor-pointer relative">
                {report.preview && (
                  <div className="absolute top-2 right-2 bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded-full">🔒 Preview</div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <SeverityBadge severity={report.severity_assessment?.overall_severity || 'Unknown'} />
                  <span className="text-gray-500 text-sm">{report.haunting_type}</span>
                </div>
                {!report.preview ? (
                  <>
                    <p className="text-gray-400 text-sm mb-3 line-clamp-2">{report.activity_description}</p>
                    <div className="text-gray-500 text-xs">
                      📍 {report.location?.address || `${report.location?.latitude?.toFixed(2)}, ${report.location?.longitude?.toFixed(2)}`}
                    </div>
                  </>
                ) : (
                  <p className="text-gray-500 text-sm">{report.message}</p>
                )}
                <div className="text-gray-600 text-xs mt-2">{new Date(report.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const HauntingReportForm = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    property_type: '', property_age: '', property_history: '',
    haunting_type: '', activity_description: '', frequency: 'Weekly',
    duration_months: 1, triggers: '',
    psychological_symptoms: [], physical_symptoms: [],
    witnesses: 1, reporter_name: '', reporter_email: '', reporter_phone: '',
    visibility: 'subscribers', seeking_help: true, urgent: false
  });
  const [location, setLocation] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState({ haunting_types: [] });

  useEffect(() => {
    axios.get(`${API}/categories`).then(res => setCategories(res.data));
  }, []);

  const psychSymptoms = ['Anxiety', 'Sleep disturbances', 'Nightmares', 'Depression', 'Fear', 'Feeling watched', 'Mood changes', 'Memory issues'];
  const physSymptoms = ['Scratches', 'Bruises', 'Burns', 'Being pushed/touched', 'Hair pulling', 'Headaches', 'Nausea', 'Temperature changes'];

  const toggleSymptom = (type, symptom) => {
    const field = type === 'psych' ? 'psychological_symptoms' : 'physical_symptoms';
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(symptom) ? prev[field].filter(s => s !== symptom) : [...prev[field], symptom]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!location) { toast.error('Please select a location'); return; }
    setSubmitting(true);
    try {
      const payload = { ...form, location: { latitude: location.lat, longitude: location.lng } };
      const response = await axios.post(`${API}/hauntings`, payload);
      toast.success('Report submitted! AI assessment complete.');
      navigate(`/haunting/${response.data.id}`);
    } catch (error) {
      toast.error('Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-white mb-2">Report a Haunting</h1>
        <p className="text-gray-400 mb-8">Our AI will assess the severity and provide recommendations</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Property Info */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">🏠 Property Information</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 mb-2">Property Type *</label>
                <select value={form.property_type} onChange={e => setForm({...form, property_type: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" required>
                  <option value="">Select type</option>
                  {['House', 'Apartment', 'Business', 'Church', 'Hospital', 'School', 'Land/Outdoor', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Property Age</label>
                <input type="text" value={form.property_age} onChange={e => setForm({...form, property_age: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" placeholder="e.g., Built 1920s" />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-gray-300 mb-2">Known Property History</label>
              <textarea value={form.property_history} onChange={e => setForm({...form, property_history: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" rows={3} placeholder="Any deaths, tragedies, or notable events?" />
            </div>
            <div className="mt-4">
              <label className="block text-gray-300 mb-2">Location * (Click map to select)</label>
              <LocationPicker onLocationSelect={setLocation} />
              {location && <p className="text-gray-500 text-sm mt-2">Selected: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>}
            </div>
          </div>

          {/* Activity Details */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">👻 Activity Details</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 mb-2">Type of Haunting *</label>
                <select value={form.haunting_type} onChange={e => setForm({...form, haunting_type: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" required>
                  <option value="">Select type</option>
                  {categories.haunting_types?.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Frequency *</label>
                <select value={form.frequency} onChange={e => setForm({...form, frequency: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3">
                  {['Daily', 'Weekly', 'Monthly', 'Occasional'].map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-gray-300 mb-2">Describe the Activity *</label>
              <textarea value={form.activity_description} onChange={e => setForm({...form, activity_description: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" rows={5} placeholder="Describe what has been happening in detail..." required />
            </div>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-gray-300 mb-2">How long has this been happening? (months)</label>
                <input type="number" min="1" value={form.duration_months} onChange={e => setForm({...form, duration_months: parseInt(e.target.value)})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Number of Witnesses</label>
                <input type="number" min="1" value={form.witnesses} onChange={e => setForm({...form, witnesses: parseInt(e.target.value)})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" />
              </div>
            </div>
          </div>

          {/* Impact Assessment */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">⚠️ Impact Assessment</h2>
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Psychological Symptoms (select all that apply)</label>
              <div className="flex flex-wrap gap-2">
                {psychSymptoms.map(s => (
                  <button key={s} type="button" onClick={() => toggleSymptom('psych', s)}
                    className={`px-3 py-1 rounded-full text-sm ${form.psychological_symptoms.includes(s) ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-gray-300 mb-2">Physical Symptoms (select all that apply)</label>
              <div className="flex flex-wrap gap-2">
                {physSymptoms.map(s => (
                  <button key={s} type="button" onClick={() => toggleSymptom('phys', s)}
                    className={`px-3 py-1 rounded-full text-sm ${form.physical_symptoms.includes(s) ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <label className="flex items-center gap-2 text-gray-300">
                <input type="checkbox" checked={form.urgent} onChange={e => setForm({...form, urgent: e.target.checked})} className="w-5 h-5 rounded" />
                <span className="text-red-400 font-semibold">🚨 This is urgent</span>
              </label>
            </div>
          </div>

          {/* Contact & Privacy */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">📞 Contact & Privacy</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 mb-2">Your Name *</label>
                <input type="text" value={form.reporter_name} onChange={e => setForm({...form, reporter_name: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" required />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Email *</label>
                <input type="email" value={form.reporter_email} onChange={e => setForm({...form, reporter_email: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" required />
              </div>
            </div>
            <div className="mt-4 grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 mb-2">Phone (optional)</label>
                <input type="tel" value={form.reporter_phone} onChange={e => setForm({...form, reporter_phone: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Report Visibility</label>
                <select value={form.visibility} onChange={e => setForm({...form, visibility: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3">
                  <option value="subscribers">Subscribers Only</option>
                  <option value="public">Public (Anyone can view)</option>
                  <option value="private">Private (Only me & investigators)</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="flex items-center gap-2 text-gray-300">
                <input type="checkbox" checked={form.seeking_help} onChange={e => setForm({...form, seeking_help: e.target.checked})} className="w-5 h-5 rounded" />
                I would like an investigator to contact me
              </label>
            </div>
          </div>

          <button type="submit" disabled={submitting} className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white py-4 rounded-lg font-semibold text-lg">
            {submitting ? 'Analyzing & Submitting...' : 'Submit Report & Get AI Assessment'}
          </button>
        </form>
      </div>
    </div>
  );
};

const HauntingDetailPage = () => {
  const { id } = useParams();
  const { isSubscriber } = useAuth();
  const [report, setReport] = useState(null);
  const [investigators, setInvestigators] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/hauntings/${id}?is_subscriber=${isSubscriber ? 'true' : 'false'}`),
      axios.get(`${API}/investigators?active_only=true&limit=5`)
    ]).then(([reportRes, invRes]) => {
      setReport(reportRes.data);
      setInvestigators(invRes.data.investigators);
    }).finally(() => setLoading(false));
  }, [id, isSubscriber]);

  const requestHelp = async (investigatorId) => {
    try {
      await axios.post(`${API}/hauntings/${id}/request-help?investigator_id=${investigatorId}`);
      toast.success('Help request sent to investigator!');
    } catch (error) {
      toast.error('Failed to send request');
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div></div>;
  if (!report) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Report not found</div>;
  if (report.preview) return (
    <div className="min-h-screen bg-gray-900 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <SubscriberGate message="Subscribe to view full haunting report details and AI severity assessment" />
      </div>
    </div>
  );

  const severity = report.severity_assessment;

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center gap-4 mb-6">
          <SeverityBadge severity={severity?.overall_severity} />
          <span className="text-gray-400">{report.haunting_type}</span>
          {report.urgent && <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full">🚨 URGENT</span>}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Activity Description</h2>
              <p className="text-gray-300 whitespace-pre-wrap">{report.activity_description}</p>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Property:</span> <span className="text-gray-300">{report.property_type}</span></div>
                <div><span className="text-gray-500">Frequency:</span> <span className="text-gray-300">{report.frequency}</span></div>
                <div><span className="text-gray-500">Duration:</span> <span className="text-gray-300">{report.duration_months} months</span></div>
                <div><span className="text-gray-500">Witnesses:</span> <span className="text-gray-300">{report.witnesses}</span></div>
              </div>
            </div>

            {/* AI Severity Assessment */}
            {severity && (
              <div className="bg-gray-800/50 border border-red-500/30 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">🤖 AI Severity Assessment</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <div className="mb-4">
                      <span className="text-gray-400 text-sm">Overall Severity</span>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex-1 bg-gray-700 rounded-full h-4">
                          <div className={`h-4 rounded-full ${severityColors[severity.overall_severity]}`} style={{width: `${severity.severity_score}%`}} />
                        </div>
                        <span className="text-white font-bold">{severity.severity_score}%</span>
                      </div>
                    </div>
                    <div className="mb-4">
                      <span className="text-gray-400 text-sm">Psychological Impact ({severity.psychological_score}/10)</span>
                      <p className="text-gray-300 mt-1">{severity.psychological_impact}</p>
                    </div>
                    <div>
                      <span className="text-gray-400 text-sm">Physical Danger ({severity.physical_score}/10)</span>
                      <p className="text-gray-300 mt-1">{severity.physical_danger}</p>
                    </div>
                  </div>
                  <div>
                    <div className="mb-4">
                      <span className="text-gray-400 text-sm">Recommended Actions</span>
                      <ul className="mt-1 space-y-1">
                        {severity.recommended_actions?.map((a, i) => <li key={i} className="text-gray-300 text-sm flex items-start"><span className="text-purple-400 mr-2">•</span>{a}</li>)}
                      </ul>
                    </div>
                    <div>
                      <span className="text-gray-400 text-sm">Warning Signs to Watch</span>
                      <ul className="mt-1 space-y-1">
                        {severity.warning_signs?.map((w, i) => <li key={i} className="text-red-400 text-sm flex items-start"><span className="mr-2">⚠️</span>{w}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Symptoms */}
            {(report.psychological_symptoms?.length > 0 || report.physical_symptoms?.length > 0) && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">Reported Symptoms</h2>
                {report.psychological_symptoms?.length > 0 && (
                  <div className="mb-4">
                    <span className="text-gray-400 text-sm">Psychological</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {report.psychological_symptoms.map((s, i) => <span key={i} className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-sm">{s}</span>)}
                    </div>
                  </div>
                )}
                {report.physical_symptoms?.length > 0 && (
                  <div>
                    <span className="text-gray-400 text-sm">Physical</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {report.physical_symptoms.map((s, i) => <span key={i} className="bg-red-500/20 text-red-300 px-3 py-1 rounded-full text-sm">{s}</span>)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Request Help */}
            {report.seeking_help && (
              <div className="bg-gray-800/50 border border-purple-500/30 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">🔍 Request Investigation</h3>
                <p className="text-gray-400 text-sm mb-4">Connect with professional investigators</p>
                {investigators.slice(0, 3).map(inv => (
                  <div key={inv.id} className="bg-gray-700/50 rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{inv.name}</p>
                        <div className="flex items-center gap-1">
                          <StarRating rating={Math.round(inv.rating)} size="text-xs" />
                          <span className="text-gray-500 text-xs">({inv.review_count})</span>
                        </div>
                      </div>
                      <button onClick={() => requestHelp(inv.id)} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm">
                        Request
                      </button>
                    </div>
                  </div>
                ))}
                <Link to="/investigators" className="text-purple-400 hover:text-purple-300 text-sm">View all investigators →</Link>
              </div>
            )}

            {/* Location */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">📍 Location</h3>
              <div style={{height: '200px'}} className="rounded-lg overflow-hidden">
                <MapContainer center={[report.location.latitude, report.location.longitude]} zoom={10} style={{height: '100%', width: '100%'}}>
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                  <Marker position={[report.location.latitude, report.location.longitude]} />
                </MapContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const InvestigatorsPage = () => {
  const [investigators, setInvestigators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${API}/investigators`).then(res => setInvestigators(res.data.investigators)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-wrap items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Paranormal Investigators</h1>
            <p className="text-gray-400">Find professional investigators in your area</p>
          </div>
          <Link to="/investigators/register" className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg">
            + Register as Investigator
          </Link>
        </div>

        <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search by name or location..." className="w-full md:w-96 bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 mb-6" />

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div></div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {investigators.filter(i => !filter || i.name.toLowerCase().includes(filter.toLowerCase()) || i.service_areas?.some(a => a.toLowerCase().includes(filter.toLowerCase()))).map(inv => (
              <div key={inv.id} onClick={() => navigate(`/investigator/${inv.id}`)} className="bg-gray-800/50 border border-green-500/20 rounded-xl p-5 hover:border-green-500/50 cursor-pointer">
                {inv.featured && <div className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded-full inline-block mb-2">⭐ Featured</div>}
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center text-2xl">
                    {inv.profile_photo ? <img src={inv.profile_photo} alt="" className="w-full h-full rounded-full object-cover" /> : '🔍'}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{inv.name}</h3>
                    <div className="flex items-center gap-1">
                      <StarRating rating={Math.round(inv.rating)} size="text-sm" />
                      <span className="text-gray-500 text-sm">({inv.review_count})</span>
                    </div>
                    <p className="text-gray-500 text-sm">{inv.years_experience} years experience</p>
                  </div>
                </div>
                <p className="text-gray-400 text-sm mt-3 line-clamp-2">{inv.bio}</p>
                <div className="flex flex-wrap gap-1 mt-3">
                  {inv.specializations?.slice(0, 3).map((s, i) => <span key={i} className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs">{s}</span>)}
                </div>
                <div className="text-gray-500 text-xs mt-3">📍 {inv.service_areas?.slice(0, 2).join(', ')}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const InvestigatorRegisterForm = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', phone: '', bio: '', years_experience: 1,
    specializations: [], service_areas: [], equipment_list: [],
    willing_to_travel: true, travel_radius_km: 100, website: ''
  });
  const [newSpec, setNewSpec] = useState('');
  const [newArea, setNewArea] = useState('');
  const [newEquip, setNewEquip] = useState('');
  const [location, setLocation] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const addItem = (field, value, setter) => {
    if (value.trim()) {
      setForm(prev => ({...prev, [field]: [...prev[field], value.trim()]}));
      setter('');
    }
  };

  const removeItem = (field, index) => {
    setForm(prev => ({...prev, [field]: prev[field].filter((_, i) => i !== index)}));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        user_id: `inv_${Date.now()}`,
        location: location ? { latitude: location.lat, longitude: location.lng } : null
      };
      await axios.post(`${API}/investigators`, payload);
      toast.success('Profile created! Please subscribe to activate your listing.');
      navigate('/pricing');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create profile');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-white mb-2">Register as Investigator</h1>
        <p className="text-gray-400 mb-8">Create your profile and start receiving booking requests</p>

        <div className="bg-gradient-to-r from-green-900/30 to-teal-900/30 border border-green-500/30 rounded-xl p-6 mb-8">
          <h3 className="text-xl font-bold text-white mb-2">Investigator Subscription</h3>
          <div className="flex gap-6">
            <div><span className="text-2xl font-bold text-green-400">£20</span><span className="text-gray-400">/month</span></div>
            <div><span className="text-2xl font-bold text-green-400">£200</span><span className="text-gray-400">/year (save £40)</span></div>
          </div>
          <p className="text-gray-300 mt-2">Includes: Profile listing, booking system, donations, all premium features</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Basic Information</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 mb-2">Full Name *</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" required />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Email *</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" required />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Phone</label>
                <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Years Experience *</label>
                <input type="number" min="0" value={form.years_experience} onChange={e => setForm({...form, years_experience: parseInt(e.target.value)})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" required />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-gray-300 mb-2">Bio / About You *</label>
              <textarea value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" rows={4} placeholder="Tell potential clients about your experience, approach, and notable investigations..." required />
            </div>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Specializations</h2>
            <div className="flex gap-2 mb-2">
              <input type="text" value={newSpec} onChange={e => setNewSpec(e.target.value)} placeholder="e.g., Residential Hauntings" className="flex-1 bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2" onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addItem('specializations', newSpec, setNewSpec))} />
              <button type="button" onClick={() => addItem('specializations', newSpec, setNewSpec)} className="bg-purple-600 text-white px-4 rounded-lg">Add</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.specializations.map((s, i) => <span key={i} className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-sm flex items-center gap-1">{s}<button type="button" onClick={() => removeItem('specializations', i)} className="text-purple-400 hover:text-white">×</button></span>)}
            </div>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Service Areas</h2>
            <div className="flex gap-2 mb-2">
              <input type="text" value={newArea} onChange={e => setNewArea(e.target.value)} placeholder="e.g., Greater London, Manchester" className="flex-1 bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2" onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addItem('service_areas', newArea, setNewArea))} />
              <button type="button" onClick={() => addItem('service_areas', newArea, setNewArea)} className="bg-purple-600 text-white px-4 rounded-lg">Add</button>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {form.service_areas.map((a, i) => <span key={i} className="bg-green-500/20 text-green-300 px-3 py-1 rounded-full text-sm flex items-center gap-1">{a}<button type="button" onClick={() => removeItem('service_areas', i)} className="text-green-400 hover:text-white">×</button></span>)}
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-gray-300">
                <input type="checkbox" checked={form.willing_to_travel} onChange={e => setForm({...form, willing_to_travel: e.target.checked})} className="w-5 h-5 rounded" />
                Willing to travel
              </label>
              {form.willing_to_travel && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Up to</span>
                  <input type="number" value={form.travel_radius_km} onChange={e => setForm({...form, travel_radius_km: parseInt(e.target.value)})} className="w-20 bg-gray-700 border border-gray-600 text-white rounded px-2 py-1" />
                  <span className="text-gray-400">km</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Equipment</h2>
            <div className="flex gap-2 mb-2">
              <input type="text" value={newEquip} onChange={e => setNewEquip(e.target.value)} placeholder="e.g., K-II Meter, Spirit Box" className="flex-1 bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2" onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addItem('equipment_list', newEquip, setNewEquip))} />
              <button type="button" onClick={() => addItem('equipment_list', newEquip, setNewEquip)} className="bg-purple-600 text-white px-4 rounded-lg">Add</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.equipment_list.map((e, i) => <span key={i} className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm flex items-center gap-1">{e}<button type="button" onClick={() => removeItem('equipment_list', i)} className="text-blue-400 hover:text-white">×</button></span>)}
            </div>
          </div>

          <button type="submit" disabled={submitting} className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white py-4 rounded-lg font-semibold text-lg">
            {submitting ? 'Creating Profile...' : 'Create Profile & Continue to Payment'}
          </button>
        </form>
      </div>
    </div>
  );
};

const InvestigatorDetailPage = () => {
  const { id } = useParams();
  const { user, isSubscriber } = useAuth();
  const [investigator, setInvestigator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [bookingForm, setBookingForm] = useState({ client_name: '', client_email: '', client_phone: '', message: '', preferred_dates: [] });
  const [location, setLocation] = useState(null);
  const [donationAmount, setDonationAmount] = useState(5);
  const [reviewForm, setReviewForm] = useState({ rating: 0, review_text: '' });

  useEffect(() => {
    axios.get(`${API}/investigators/${id}`).then(res => setInvestigator(res.data)).finally(() => setLoading(false));
  }, [id]);

  const submitBooking = async () => {
    if (!location) { toast.error('Please select a location'); return; }
    try {
      await axios.post(`${API}/bookings`, {
        investigator_id: id,
        ...bookingForm,
        location: { latitude: location.lat, longitude: location.lng }
      });
      toast.success('Booking request sent!');
      setShowBooking(false);
    } catch (error) {
      toast.error('Failed to send booking request');
    }
  };

  const submitDonation = async () => {
    try {
      await axios.post(`${API}/investigators/${id}/donate`, {
        investigator_id: id,
        donor_name: user?.name || 'Anonymous',
        amount_gbp: donationAmount * 100,
        anonymous: !user
      });
      toast.success(`Thank you for your £${donationAmount} donation!`);
    } catch (error) {
      toast.error('Failed to process donation');
    }
  };

  const submitReview = async () => {
    if (!reviewForm.rating) { toast.error('Please select a rating'); return; }
    try {
      await axios.post(`${API}/investigators/${id}/review?user_id=${user?.id || 'anon'}&user_name=${user?.name || 'Anonymous'}&rating=${reviewForm.rating}&review_text=${reviewForm.review_text}`);
      toast.success('Review submitted!');
      setReviewForm({ rating: 0, review_text: '' });
      // Refresh
      const res = await axios.get(`${API}/investigators/${id}`);
      setInvestigator(res.data);
    } catch (error) {
      toast.error('Failed to submit review');
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div></div>;
  if (!investigator) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Investigator not found</div>;

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center text-4xl shrink-0">
              {investigator.profile_photo ? <img src={investigator.profile_photo} alt="" className="w-full h-full rounded-full object-cover" /> : '🔍'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-white">{investigator.name}</h1>
                {investigator.verified && <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full">✓ Verified</span>}
                {investigator.featured && <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded-full">⭐ Featured</span>}
              </div>
              <div className="flex items-center gap-3 mb-3">
                <StarRating rating={Math.round(investigator.rating)} />
                <span className="text-gray-400">({investigator.review_count} reviews)</span>
                <span className="text-gray-500">•</span>
                <span className="text-gray-400">{investigator.years_experience} years experience</span>
              </div>
              <p className="text-gray-300">{investigator.bio}</p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button onClick={() => setShowBooking(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg">
                📅 Book Investigation
              </button>
              <button onClick={submitDonation} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg">
                💰 Tip £{donationAmount}
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Specializations & Equipment */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Specializations & Equipment</h2>
              {investigator.specializations?.length > 0 && (
                <div className="mb-4">
                  <span className="text-gray-400 text-sm">Specializations</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {investigator.specializations.map((s, i) => <span key={i} className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-sm">{s}</span>)}
                  </div>
                </div>
              )}
              {investigator.equipment_list?.length > 0 && (
                <div>
                  <span className="text-gray-400 text-sm">Equipment</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {investigator.equipment_list.map((e, i) => <span key={i} className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm">{e}</span>)}
                  </div>
                </div>
              )}
            </div>

            {/* Reviews */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Reviews</h2>
              
              {/* Add Review */}
              <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
                <p className="text-gray-300 text-sm mb-2">Leave a review:</p>
                <div className="flex items-center gap-2 mb-2">
                  <StarRating rating={reviewForm.rating} onRate={(r) => setReviewForm({...reviewForm, rating: r})} interactive />
                </div>
                <textarea value={reviewForm.review_text} onChange={e => setReviewForm({...reviewForm, review_text: e.target.value})} className="w-full bg-gray-600 border border-gray-500 text-white rounded px-3 py-2 text-sm mb-2" rows={2} placeholder="Share your experience..." />
                <button onClick={submitReview} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1 rounded text-sm">Submit Review</button>
              </div>

              {/* Review List */}
              <div className="space-y-4">
                {investigator.reviews?.map(review => (
                  <div key={review.id} className="border-b border-gray-700 pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{review.user_name}</span>
                        <StarRating rating={review.rating} size="text-sm" />
                      </div>
                      <span className="text-gray-500 text-xs">{new Date(review.timestamp).toLocaleDateString()}</span>
                    </div>
                    <p className="text-gray-300 text-sm">{review.review_text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">📍 Service Areas</h3>
              <div className="space-y-1">
                {investigator.service_areas?.map((a, i) => <p key={i} className="text-gray-300">{a}</p>)}
              </div>
              {investigator.willing_to_travel && (
                <p className="text-gray-500 text-sm mt-2">Will travel up to {investigator.travel_radius_km}km</p>
              )}
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">📞 Contact</h3>
              <p className="text-gray-300">{investigator.email}</p>
              {investigator.phone && <p className="text-gray-300">{investigator.phone}</p>}
              {investigator.website && <a href={investigator.website} target="_blank" rel="noreferrer" className="text-purple-400 hover:text-purple-300">{investigator.website}</a>}
            </div>

            {/* Donation */}
            <div className="bg-gray-800/50 border border-green-500/30 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">💰 Support This Investigator</h3>
              <div className="flex gap-2 mb-4">
                {[5, 10, 20, 50].map(amount => (
                  <button key={amount} onClick={() => setDonationAmount(amount)} className={`px-4 py-2 rounded-lg ${donationAmount === amount ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                    £{amount}
                  </button>
                ))}
              </div>
              <button onClick={submitDonation} className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg">
                Donate £{donationAmount}
              </button>
            </div>
          </div>
        </div>

        {/* Booking Modal */}
        {showBooking && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-white mb-4">Book Investigation with {investigator.name}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 mb-2">Your Name *</label>
                  <input type="text" value={bookingForm.client_name} onChange={e => setBookingForm({...bookingForm, client_name: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2" required />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Email *</label>
                  <input type="email" value={bookingForm.client_email} onChange={e => setBookingForm({...bookingForm, client_email: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2" required />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Phone</label>
                  <input type="tel" value={bookingForm.client_phone} onChange={e => setBookingForm({...bookingForm, client_phone: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2" />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Location * (Click map)</label>
                  <LocationPicker onLocationSelect={setLocation} />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Message *</label>
                  <textarea value={bookingForm.message} onChange={e => setBookingForm({...bookingForm, message: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2" rows={3} placeholder="Describe your situation..." required />
                </div>
              </div>
              <div className="flex gap-4 mt-6">
                <button onClick={() => setShowBooking(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg">Cancel</button>
                <button onClick={submitBooking} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg">Send Request</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const EquipmentPage = () => {
  const [reviews, setReviews] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/equipment`),
      axios.get(`${API}/categories`)
    ]).then(([reviewsRes, categoriesRes]) => {
      setReviews(reviewsRes.data.reviews);
      setCategories(categoriesRes.data.equipment_categories);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-wrap items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Equipment Reviews</h1>
            <p className="text-gray-400">Ghost hunting gear reviewed by investigators</p>
          </div>
          <Link to="/equipment/review" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg">
            + Write Review
          </Link>
        </div>

        <select value={filter} onChange={e => setFilter(e.target.value)} className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 mb-6">
          <option value="">All Categories</option>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div></div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.filter(r => !filter || r.category === filter).map(review => (
              <div key={review.id} className="bg-gray-800/50 border border-blue-500/20 rounded-xl p-5 hover:border-blue-500/50 cursor-pointer" onClick={() => navigate(`/equipment/${review.id}`)}>
                <div className="flex items-start gap-4 mb-3">
                  <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center text-2xl">
                    {review.image_url ? <img src={review.image_url} alt="" className="w-full h-full rounded-lg object-cover" /> : '🛠️'}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{review.name}</h3>
                    <p className="text-gray-500 text-sm">{review.brand}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <StarRating rating={review.rating} size="text-sm" />
                      {review.recommended && <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded">✓ Recommended</span>}
                    </div>
                  </div>
                </div>
                <p className="text-gray-400 text-sm line-clamp-2">{review.review_text}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-gray-500 text-xs">{review.reviewer_type === 'investigator' ? '🔍 Investigator' : '👤 User'}</span>
                  <span className="text-gray-500 text-xs">👍 {review.helpful_votes} helpful</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const EquipmentReviewForm = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: '', brand: '', category: '', model_number: '', price_range: 'Mid-range',
    purchase_link: '', reviewer_type: 'user', rating: 0,
    review_title: '', review_text: '', pros: [], cons: [], recommended: true, use_cases: []
  });
  const [newPro, setNewPro] = useState('');
  const [newCon, setNewCon] = useState('');
  const [categories, setCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axios.get(`${API}/categories`).then(res => setCategories(res.data.equipment_categories));
  }, []);

  const addItem = (field, value, setter) => {
    if (value.trim()) {
      setForm(prev => ({...prev, [field]: [...prev[field], value.trim()]}));
      setter('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.rating) { toast.error('Please select a rating'); return; }
    setSubmitting(true);
    try {
      await axios.post(`${API}/equipment`, {
        ...form,
        reviewer_id: user?.id || 'anon',
        reviewer_name: user?.name || 'Anonymous'
      });
      toast.success('Review submitted!');
      navigate('/equipment');
    } catch (error) {
      toast.error('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-white mb-8">Review Equipment</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Product Details</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 mb-2">Product Name *</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" required />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Brand *</label>
                <input type="text" value={form.brand} onChange={e => setForm({...form, brand: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" required />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Category *</label>
                <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" required>
                  <option value="">Select category</option>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Price Range</label>
                <select value={form.price_range} onChange={e => setForm({...form, price_range: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3">
                  {['Budget', 'Mid-range', 'Professional'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-gray-300 mb-2">Purchase Link (affiliate)</label>
              <input type="url" value={form.purchase_link} onChange={e => setForm({...form, purchase_link: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" placeholder="https://..." />
            </div>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Your Review</h2>
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Rating *</label>
              <StarRating rating={form.rating} onRate={(r) => setForm({...form, rating: r})} interactive size="text-3xl" />
            </div>
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Review Title *</label>
              <input type="text" value={form.review_title} onChange={e => setForm({...form, review_title: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" required />
            </div>
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Review *</label>
              <textarea value={form.review_text} onChange={e => setForm({...form, review_text: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" rows={5} required />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 mb-2">Pros</label>
                <div className="flex gap-2 mb-2">
                  <input type="text" value={newPro} onChange={e => setNewPro(e.target.value)} className="flex-1 bg-gray-700 border border-gray-600 text-white rounded px-3 py-2" onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addItem('pros', newPro, setNewPro))} />
                  <button type="button" onClick={() => addItem('pros', newPro, setNewPro)} className="bg-green-600 text-white px-3 rounded">+</button>
                </div>
                <div className="space-y-1">{form.pros.map((p, i) => <div key={i} className="text-green-400 text-sm">✓ {p}</div>)}</div>
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Cons</label>
                <div className="flex gap-2 mb-2">
                  <input type="text" value={newCon} onChange={e => setNewCon(e.target.value)} className="flex-1 bg-gray-700 border border-gray-600 text-white rounded px-3 py-2" onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addItem('cons', newCon, setNewCon))} />
                  <button type="button" onClick={() => addItem('cons', newCon, setNewCon)} className="bg-red-600 text-white px-3 rounded">+</button>
                </div>
                <div className="space-y-1">{form.cons.map((c, i) => <div key={i} className="text-red-400 text-sm">✗ {c}</div>)}</div>
              </div>
            </div>
            <div className="mt-4">
              <label className="flex items-center gap-2 text-gray-300">
                <input type="checkbox" checked={form.recommended} onChange={e => setForm({...form, recommended: e.target.checked})} className="w-5 h-5 rounded" />
                I recommend this product
              </label>
            </div>
          </div>

          <button type="submit" disabled={submitting} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white py-4 rounded-lg font-semibold text-lg">
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </form>
      </div>
    </div>
  );
};

const PricingPage = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/subscription/plans`).then(res => setPlans(res.data.plans)).finally(() => setLoading(false));
  }, []);

  const subscribe = async (planType, plan) => {
    if (!user) {
      toast.error('Please login first');
      navigate('/login');
      return;
    }
    try {
      await axios.post(`${API}/subscription/create`, {
        user_id: user.id,
        user_email: user.email,
        subscription_type: planType,
        plan: plan
      });
      toast.success('Subscription activated!');
      // Refresh auth
      login(user);
      navigate('/dashboard');
    } catch (error) {
      toast.error('Failed to create subscription');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 py-12">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Subscription Plans</h1>
          <p className="text-gray-400 text-lg">Unlock full access to paranormal reports and features</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* User Plan */}
          <div className="bg-gray-800/50 border border-purple-500/30 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-2">User</h2>
            <div className="mb-6">
              <span className="text-4xl font-bold text-purple-400">£9.99</span>
              <span className="text-gray-400">/month</span>
            </div>
            <ul className="space-y-3 mb-8">
              {['Access all detailed reports', 'View haunting case details', 'AI severity assessments', 'Contact investigators', 'Equipment reviews', 'Community features'].map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-300">
                  <span className="text-purple-400">✓</span> {f}
                </li>
              ))}
            </ul>
            <button onClick={() => subscribe('user', 'monthly')} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold">
              Subscribe
            </button>
          </div>

          {/* Investigator Monthly */}
          <div className="bg-gradient-to-b from-green-900/30 to-gray-800/50 border border-green-500/50 rounded-2xl p-8 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs px-3 py-1 rounded-full">Most Popular</div>
            <h2 className="text-2xl font-bold text-white mb-2">Investigator</h2>
            <div className="mb-6">
              <span className="text-4xl font-bold text-green-400">£20</span>
              <span className="text-gray-400">/month</span>
            </div>
            <ul className="space-y-3 mb-8">
              {['All User features', 'List your services', 'Receive bookings', 'Accept donations', 'Featured in directory', 'Priority support'].map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-300">
                  <span className="text-green-400">✓</span> {f}
                </li>
              ))}
            </ul>
            <button onClick={() => subscribe('investigator', 'monthly')} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold">
              Subscribe
            </button>
          </div>

          {/* Investigator Yearly */}
          <div className="bg-gray-800/50 border border-yellow-500/30 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-2">Investigator Yearly</h2>
            <div className="mb-2">
              <span className="text-4xl font-bold text-yellow-400">£200</span>
              <span className="text-gray-400">/year</span>
            </div>
            <p className="text-green-400 text-sm mb-4">Save £40 per year!</p>
            <ul className="space-y-3 mb-8">
              {['All Investigator features', '2 months FREE', 'Featured listing boost', 'Priority support', 'Early access to features'].map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-300">
                  <span className="text-yellow-400">✓</span> {f}
                </li>
              ))}
            </ul>
            <button onClick={() => subscribe('investigator', 'yearly')} className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-3 rounded-lg font-semibold">
              Subscribe Yearly
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', name: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    const user = {
      id: `user_${Date.now()}`,
      email: form.email,
      name: form.name || form.email.split('@')[0]
    };
    login(user);
    toast.success('Logged in successfully!');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Welcome Back</h1>
          <p className="text-gray-400">Sign in to access your account</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-gray-800/50 border border-gray-700 rounded-xl p-8">
          <div className="mb-4">
            <label className="block text-gray-300 mb-2">Email</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" required />
          </div>
          <div className="mb-6">
            <label className="block text-gray-300 mb-2">Name (optional)</label>
            <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" />
          </div>
          <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
};

const DashboardPage = () => {
  const { user, subscription, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-white mb-8">Dashboard</h1>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Account</h2>
            <p className="text-gray-300 mb-2"><span className="text-gray-500">Email:</span> {user.email}</p>
            <p className="text-gray-300 mb-4"><span className="text-gray-500">Name:</span> {user.name}</p>
            <button onClick={logout} className="text-red-400 hover:text-red-300">Logout</button>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Subscription</h2>
            {subscription?.is_subscriber ? (
              <>
                <p className="text-green-400 mb-2">✓ Active Subscription</p>
                <p className="text-gray-300"><span className="text-gray-500">Type:</span> {subscription.subscription?.subscription_type}</p>
                <p className="text-gray-300"><span className="text-gray-500">Expires:</span> {new Date(subscription.subscription?.expires_at).toLocaleDateString()}</p>
              </>
            ) : (
              <>
                <p className="text-gray-400 mb-4">No active subscription</p>
                <Link to="/pricing" className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg inline-block">
                  Subscribe Now
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const SightingReportForm = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '', description: '', category: '', date_occurred: '',
    witness_count: 1, reporter_name: '', reporter_email: '', evidence_photos: []
  });
  const [location, setLocation] = useState(null);
  const [categories, setCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axios.get(`${API}/categories`).then(res => setCategories(res.data.categories));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!location) { toast.error('Please select a location'); return; }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        date_occurred: new Date(form.date_occurred).toISOString(),
        location: { latitude: location.lat, longitude: location.lng }
      };
      const response = await axios.post(`${API}/sightings`, payload);
      toast.success('Sighting reported! AI analysis complete.');
      navigate(`/sighting/${response.data.id}`);
    } catch (error) {
      toast.error('Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-white mb-8">Report a Sighting</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Title *</label>
              <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" required />
            </div>
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Category *</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" required>
                <option value="">Select category</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Description *</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" rows={5} required />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 mb-2">Date/Time *</label>
                <input type="datetime-local" value={form.date_occurred} onChange={e => setForm({...form, date_occurred: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" required />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Witnesses</label>
                <input type="number" min="1" value={form.witness_count} onChange={e => setForm({...form, witness_count: parseInt(e.target.value)})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-gray-300 mb-2">Location * (Click map)</label>
              <LocationPicker onLocationSelect={setLocation} />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white py-4 rounded-lg font-semibold text-lg">
            {submitting ? 'Analyzing...' : 'Submit Report'}
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

  useEffect(() => {
    axios.get(`${API}/sightings/${id}`).then(res => setSighting(res.data)).finally(() => setLoading(false));
  }, [id]);

  const submitRating = async () => {
    if (!ratingScore) return;
    try {
      await axios.post(`${API}/sightings/${id}/rate`, {
        user_id: `user_${Date.now()}`,
        score: ratingScore
      });
      toast.success('Rating submitted!');
      const res = await axios.get(`${API}/sightings/${id}`);
      setSighting(res.data);
      setRatingScore(0);
    } catch (error) {
      toast.error('Failed to submit rating');
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div></div>;
  if (!sighting) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Not found</div>;

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-3xl font-bold text-white">{sighting.title}</h1>
          {sighting.verified && <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full">✓ Verified</span>}
        </div>
        <div className="flex items-center gap-3 mb-6">
          <span className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-sm">{sighting.category}</span>
          <span className="text-gray-500">{new Date(sighting.date_occurred).toLocaleString()}</span>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Description</h2>
              <p className="text-gray-300 whitespace-pre-wrap">{sighting.description}</p>
            </div>

            {sighting.ai_analysis && (
              <div className="bg-gray-800/50 border border-purple-500/30 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">🤖 AI Analysis</h2>
                <div className="mb-4">
                  <span className="text-gray-400 text-sm">Credibility Score</span>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex-1 bg-gray-700 rounded-full h-3">
                      <div className={`h-3 rounded-full ${sighting.ai_analysis.credibility_score >= 70 ? 'bg-green-500' : sighting.ai_analysis.credibility_score >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{width: `${sighting.ai_analysis.credibility_score}%`}} />
                    </div>
                    <span className="text-white font-bold">{sighting.ai_analysis.credibility_score}%</span>
                  </div>
                </div>
                <p className="text-gray-300 mb-4">{sighting.ai_analysis.analysis_summary}</p>
                {sighting.ai_analysis.suggested_investigation_steps?.length > 0 && (
                  <div>
                    <span className="text-gray-400 text-sm">Investigation Steps</span>
                    <ul className="mt-1 space-y-1">
                      {sighting.ai_analysis.suggested_investigation_steps.map((s, i) => <li key={i} className="text-gray-300 text-sm">• {s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Location</h2>
              <div style={{height: '250px'}} className="rounded-lg overflow-hidden">
                <MapContainer center={[sighting.location.latitude, sighting.location.longitude]} zoom={10} style={{height: '100%', width: '100%'}}>
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                  <Marker position={[sighting.location.latitude, sighting.location.longitude]} />
                </MapContainer>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Community Rating</h3>
              <div className="text-center mb-4">
                <div className="text-4xl font-bold text-yellow-400">
                  {sighting.ratings?.length > 0 ? (sighting.ratings.reduce((a, r) => a + r.score, 0) / sighting.ratings.length).toFixed(1) : '0.0'}
                </div>
                <StarRating rating={Math.round(sighting.ratings?.reduce((a, r) => a + r.score, 0) / (sighting.ratings?.length || 1))} />
                <p className="text-gray-500 text-sm">{sighting.ratings?.length || 0} ratings</p>
              </div>
              <div className="border-t border-gray-700 pt-4">
                <p className="text-gray-300 text-sm mb-2">Rate this sighting:</p>
                <div className="flex justify-center mb-3">
                  <StarRating rating={ratingScore} onRate={setRatingScore} interactive />
                </div>
                <button onClick={submitRating} disabled={!ratingScore} className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white py-2 rounded-lg text-sm">
                  Submit Rating
                </button>
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Details</h3>
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-500">Witnesses:</span> <span className="text-gray-300">{sighting.witness_count}</span></p>
                <p><span className="text-gray-500">Reported:</span> <span className="text-gray-300">{new Date(sighting.created_at).toLocaleDateString()}</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MapPage = () => {
  const [sightings, setSightings] = useState([]);
  const [hauntings, setHauntings] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/sightings`),
      axios.get(`${API}/hauntings?is_subscriber=true`)
    ]).then(([sRes, hRes]) => {
      setSightings(sRes.data);
      setHauntings(hRes.data.reports.filter(r => !r.preview));
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-white mb-6">Activity Map</h1>
        <div style={{height: '600px'}} className="rounded-xl overflow-hidden border border-purple-500/20">
          <MapContainer center={[54.5, -2]} zoom={5} style={{height: '100%', width: '100%'}}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            {sightings.map(s => (
              <Marker key={s.id} position={[s.location.latitude, s.location.longitude]} icon={createIcon('violet')}>
                <Popup><div className="text-gray-900"><strong>{s.title}</strong><br/><small>{s.category}</small><br/><button onClick={() => navigate(`/sighting/${s.id}`)} className="text-purple-600">View →</button></div></Popup>
              </Marker>
            ))}
            {hauntings.map(h => (
              <Marker key={h.id} position={[h.location.latitude, h.location.longitude]} icon={createIcon('red')}>
                <Popup><div className="text-gray-900"><strong>Haunting Report</strong><br/><small>{h.haunting_type}</small><br/><button onClick={() => navigate(`/haunting/${h.id}`)} className="text-purple-600">View →</button></div></Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
        <div className="flex gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-violet-500"></span><span className="text-gray-400">Sightings</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span><span className="text-gray-400">Hauntings</span></div>
        </div>
      </div>
    </div>
  );
};

// ============== VIDEO AD COMPONENTS ==============

const VideoAdPlayer = ({ ads, autoRotate = true, rotationInterval = 20000 }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!autoRotate || ads.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ads.length);
    }, rotationInterval);
    return () => clearInterval(timer);
  }, [ads.length, autoRotate, rotationInterval]);

  const recordImpression = async (adId) => {
    try {
      await axios.post(`${API}/ads/${adId}/impression`);
    } catch (e) { console.error('Failed to record impression'); }
  };

  const handleClick = async (ad) => {
    try {
      const response = await axios.post(`${API}/ads/${ad.id}/click`);
      window.open(response.data.click_url || ad.click_url, '_blank');
    } catch (e) {
      window.open(ad.click_url, '_blank');
    }
  };

  useEffect(() => {
    if (ads[currentIndex]) {
      recordImpression(ads[currentIndex].id);
    }
  }, [currentIndex, ads]);

  if (!ads || ads.length === 0) return null;

  const currentAd = ads[currentIndex];

  return (
    <div className="bg-gray-800/50 border border-yellow-500/30 rounded-xl overflow-hidden">
      <div className="bg-yellow-500/10 px-3 py-1 flex justify-between items-center">
        <span className="text-yellow-400 text-xs font-semibold">SPONSORED</span>
        <span className="text-gray-500 text-xs">{currentIndex + 1}/{ads.length}</span>
      </div>
      <div className="relative cursor-pointer" onClick={() => handleClick(currentAd)}>
        {currentAd.video_url ? (
          <video
            key={currentAd.id}
            src={currentAd.video_url}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-40 object-cover"
          />
        ) : (
          <div className="w-full h-40 bg-gray-700 flex items-center justify-center">
            <span className="text-4xl">📺</span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          <p className="text-white font-semibold text-sm">{currentAd.title}</p>
          <p className="text-gray-300 text-xs">{currentAd.company_name}</p>
        </div>
      </div>
      {ads.length > 1 && (
        <div className="flex justify-center gap-1 p-2">
          {ads.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-2 h-2 rounded-full ${i === currentIndex ? 'bg-yellow-400' : 'bg-gray-600'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const AdvertisePage = () => {
  const navigate = useNavigate();
  const [pricing, setPricing] = useState(null);
  const [form, setForm] = useState({
    advertiser_name: '', advertiser_email: '', company_name: '', category: '',
    video_url: '', thumbnail_url: '', title: '', description: '', click_url: '',
    target_pages: [], plan: 'monthly'
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axios.get(`${API}/ads/pricing`).then(res => setPricing(res.data));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.post(`${API}/ads`, form);
      toast.success('Ad submitted for review! You will be notified once approved.');
      navigate('/');
    } catch (error) {
      toast.error('Failed to submit ad');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error('Video must be under 50MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(prev => ({ ...prev, video_url: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">📺 Advertise on ParaInvestigate</h1>
          <p className="text-gray-400 text-lg">Reach thousands of paranormal enthusiasts with your 20-second video ad</p>
        </div>

        {/* Pricing Cards */}
        {pricing && (
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {pricing.plans.map((plan) => (
              <div
                key={plan.id}
                onClick={() => setForm({...form, plan: plan.id})}
                className={`rounded-xl p-6 cursor-pointer transition border-2 ${
                  form.plan === plan.id 
                    ? 'bg-yellow-500/20 border-yellow-500' 
                    : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                }`}
              >
                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                <div className="mb-2">
                  <span className="text-3xl font-bold text-yellow-400">£{plan.price_gbp}</span>
                </div>
                <p className="text-gray-400">{plan.duration_days} days of exposure</p>
                {form.plan === plan.id && (
                  <div className="mt-2 text-yellow-400 text-sm">✓ Selected</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Ad Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Your Details</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 mb-2">Your Name *</label>
                <input type="text" value={form.advertiser_name} onChange={e => setForm({...form, advertiser_name: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" required />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Email *</label>
                <input type="email" value={form.advertiser_email} onChange={e => setForm({...form, advertiser_email: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" required />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Company/Channel Name *</label>
                <input type="text" value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" required />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Category *</label>
                <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" required>
                  <option value="">Select category</option>
                  {pricing?.categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">📹 Video Ad (Max 20 seconds)</h2>
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Upload Video *</label>
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
                <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={handleVideoUpload} className="hidden" id="video-upload" />
                <label htmlFor="video-upload" className="cursor-pointer">
                  {form.video_url ? (
                    <div>
                      <video src={form.video_url} className="max-h-40 mx-auto rounded-lg mb-2" controls />
                      <p className="text-green-400 text-sm">✓ Video uploaded - Click to change</p>
                    </div>
                  ) : (
                    <div className="text-gray-400">
                      <span className="text-5xl">📹</span>
                      <p className="mt-2">Click to upload video (MP4, WebM, MOV)</p>
                      <p className="text-sm">Max 20 seconds, 50MB</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Or paste video URL</label>
              <input type="url" value={form.video_url.startsWith('data:') ? '' : form.video_url} onChange={e => setForm({...form, video_url: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" placeholder="https://youtube.com/... or direct video URL" />
            </div>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Ad Content</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-2">Ad Title *</label>
                <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" maxLength={60} required />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Description</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" rows={2} maxLength={200} />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Click-through URL *</label>
                <input type="url" value={form.click_url} onChange={e => setForm({...form, click_url: e.target.value})} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3" placeholder="https://yourwebsite.com or YouTube channel URL" required />
              </div>
            </div>
          </div>

          <button type="submit" disabled={submitting} className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-700 text-black font-bold py-4 rounded-lg text-lg">
            {submitting ? 'Submitting...' : `Submit Ad - £${pricing?.plans.find(p => p.id === form.plan)?.price_gbp || 150}`}
          </button>
        </form>
      </div>
    </div>
  );
};

// ============== AI REPORT GENERATOR ==============

const AIReportGeneratorPage = () => {
  const navigate = useNavigate();
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [convertForm, setConvertForm] = useState({ reporter_name: '', reporter_email: '' });

  const generateReport = async () => {
    if (!rawText.trim()) {
      toast.error('Please paste some information to analyze');
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post(`${API}/ai/generate-report`, {
        raw_text: rawText,
        include_location_extraction: true,
        include_media_suggestions: true,
        report_type: "auto"
      });
      setReport(response.data);
      toast.success('AI Report Generated!');
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const convertToSighting = async () => {
    try {
      const response = await axios.post(`${API}/ai/generate-report/convert-to-sighting?report_id=${report.id}`);
      toast.success('Sighting created!');
      navigate(`/sighting/${response.data.sighting_id}`);
    } catch (error) {
      toast.error('Failed to convert to sighting');
    }
  };

  const convertToHaunting = async () => {
    if (!convertForm.reporter_name || !convertForm.reporter_email) {
      toast.error('Please enter name and email');
      return;
    }
    try {
      const response = await axios.post(
        `${API}/ai/generate-report/convert-to-haunting?report_id=${report.id}&reporter_name=${convertForm.reporter_name}&reporter_email=${convertForm.reporter_email}`
      );
      toast.success('Haunting report created!');
      navigate(`/haunting/${response.data.haunting_id}`);
    } catch (error) {
      toast.error('Failed to convert to haunting');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">🤖 AI Report Generator</h1>
          <p className="text-gray-400 text-lg">Paste any information and our AI will create a structured paranormal report</p>
        </div>

        {!report ? (
          <div className="space-y-6">
            <div className="bg-gray-800/50 border border-purple-500/30 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">📋 Paste Your Information</h2>
              <p className="text-gray-400 mb-4">
                Copy and paste any text - news articles, witness accounts, social media posts, emails, or notes. 
                The AI will extract locations, dates, entities, and create a full structured report.
              </p>
              <textarea
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3 min-h-[300px] font-mono text-sm"
                placeholder={`Example input:

"Last night around 3am on November 15th 2024, my family and I witnessed something incredible at our home in York, UK. We heard loud banging from the attic, then all the lights in the house flickered. My daughter said she saw a tall shadowy figure standing at the end of the hallway. The temperature dropped suddenly - we could see our breath. This has been happening for weeks now. Three of us saw it. We're scared and don't know what to do. Our neighbors mentioned the previous owners moved out suddenly 5 years ago after strange incidents."

Paste anything - the AI will extract and analyze it!`}
              />
              <div className="flex items-center justify-between mt-4">
                <span className="text-gray-500 text-sm">{rawText.length} characters</span>
                <button
                  onClick={generateReport}
                  disabled={loading || !rawText.trim()}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white px-8 py-3 rounded-lg font-semibold"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Analyzing...
                    </span>
                  ) : (
                    '🤖 Generate Report'
                  )}
                </button>
              </div>
            </div>

            <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-3">💡 What can AI extract?</h3>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span className="text-gray-300">Location coordinates & addresses</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span className="text-gray-300">Dates and time periods</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span className="text-gray-300">Witness count</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span className="text-gray-300">Entity descriptions</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span className="text-gray-300">Credibility assessment</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span className="text-gray-300">Severity rating</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span className="text-gray-300">Key evidence</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span className="text-gray-300">Investigation steps</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span className="text-gray-300">Similar historical cases</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Generated Report Display */}
            <div className="bg-gray-800/50 border border-green-500/30 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white">{report.title}</h2>
                <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">AI Generated</span>
              </div>
              
              <div className="flex flex-wrap gap-3 mb-4">
                <span className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-sm">{report.category}</span>
                {report.haunting_type && <span className="bg-red-500/20 text-red-300 px-3 py-1 rounded-full text-sm">{report.haunting_type}</span>}
                {report.severity_assessment && <span className="bg-orange-500/20 text-orange-300 px-3 py-1 rounded-full text-sm">Severity: {report.severity_assessment}</span>}
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">Summary</h3>
                <p className="text-gray-300">{report.summary}</p>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">Detailed Description</h3>
                <p className="text-gray-300 whitespace-pre-wrap">{report.detailed_description}</p>
              </div>
            </div>

            {/* Extracted Data */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Locations */}
              {report.locations?.length > 0 && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-3">📍 Extracted Locations</h3>
                  <div className="space-y-2">
                    {report.locations.map((loc, i) => (
                      <div key={i} className="bg-gray-700/50 rounded-lg p-3">
                        <p className="text-gray-300">{loc.address || `${loc.latitude}, ${loc.longitude}`}</p>
                        <p className="text-gray-500 text-sm">Lat: {loc.latitude}, Lng: {loc.longitude}</p>
                      </div>
                    ))}
                  </div>
                  {report.locations.length > 0 && (
                    <div className="mt-4 h-48 rounded-lg overflow-hidden">
                      <MapContainer center={[report.locations[0].latitude, report.locations[0].longitude]} zoom={10} style={{height: '100%', width: '100%'}}>
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                        {report.locations.map((loc, i) => (
                          <Marker key={i} position={[loc.latitude, loc.longitude]} />
                        ))}
                      </MapContainer>
                    </div>
                  )}
                </div>
              )}

              {/* Analysis */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-3">🔍 Analysis</h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-gray-400 text-sm">Credibility Assessment</span>
                    <p className="text-gray-300">{report.credibility_assessment}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">Witnesses</span>
                    <p className="text-gray-300">{report.witnesses_mentioned}</p>
                  </div>
                  {report.dates_mentioned?.length > 0 && (
                    <div>
                      <span className="text-gray-400 text-sm">Dates Mentioned</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {report.dates_mentioned.map((d, i) => (
                          <span key={i} className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded text-sm">{d}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {report.entities_described?.length > 0 && (
                    <div>
                      <span className="text-gray-400 text-sm">Entities Described</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {report.entities_described.map((e, i) => (
                          <span key={i} className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded text-sm">{e}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Key Evidence & Recommendations */}
            <div className="grid md:grid-cols-2 gap-6">
              {report.key_evidence?.length > 0 && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-3">📸 Key Evidence</h3>
                  <ul className="space-y-2">
                    {report.key_evidence.map((e, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-300">
                        <span className="text-green-400">•</span> {e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {report.investigation_recommendations?.length > 0 && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-3">🔬 Investigation Recommendations</h3>
                  <ol className="space-y-2">
                    {report.investigation_recommendations.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-300">
                        <span className="text-purple-400">{i + 1}.</span> {r}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            {/* Similar Cases */}
            {report.similar_cases?.length > 0 && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-3">📚 Similar Historical Cases</h3>
                <div className="flex flex-wrap gap-2">
                  {report.similar_cases.map((c, i) => (
                    <span key={i} className="bg-gray-700 text-gray-300 px-3 py-1 rounded-lg text-sm">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Convert Actions */}
            <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">📝 Convert to Official Report</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-white font-semibold mb-2">Create as Sighting</h4>
                  <p className="text-gray-400 text-sm mb-3">Add this to the public sightings database</p>
                  <button onClick={convertToSighting} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg">
                    Create Sighting
                  </button>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-2">Create as Haunting Report</h4>
                  <p className="text-gray-400 text-sm mb-2">Submit as a haunting case for investigation</p>
                  <div className="flex gap-2 mb-2">
                    <input type="text" value={convertForm.reporter_name} onChange={e => setConvertForm({...convertForm, reporter_name: e.target.value})} placeholder="Your name" className="flex-1 bg-gray-700 border border-gray-600 text-white rounded px-3 py-2 text-sm" />
                    <input type="email" value={convertForm.reporter_email} onChange={e => setConvertForm({...convertForm, reporter_email: e.target.value})} placeholder="Email" className="flex-1 bg-gray-700 border border-gray-600 text-white rounded px-3 py-2 text-sm" />
                  </div>
                  <button onClick={convertToHaunting} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg">
                    Create Haunting Report
                  </button>
                </div>
              </div>
            </div>

            {/* Start Over */}
            <button onClick={() => { setReport(null); setRawText(''); }} className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg">
              ← Generate Another Report
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <Toaster position="top-right" richColors />
        <BrowserRouter>
          <Navbar />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/sightings" element={<SightingsPage />} />
            <Route path="/sightings/report" element={<SightingReportForm />} />
            <Route path="/sighting/:id" element={<SightingDetailPage />} />
            <Route path="/hauntings" element={<HauntingsPage />} />
            <Route path="/hauntings/report" element={<HauntingReportForm />} />
            <Route path="/haunting/:id" element={<HauntingDetailPage />} />
            <Route path="/investigators" element={<InvestigatorsPage />} />
            <Route path="/investigators/register" element={<InvestigatorRegisterForm />} />
            <Route path="/investigator/:id" element={<InvestigatorDetailPage />} />
            <Route path="/equipment" element={<EquipmentPage />} />
            <Route path="/equipment/review" element={<EquipmentReviewForm />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/map" element={<MapPage />} />
          </Routes>
        </BrowserRouter>
      </div>
    </AuthProvider>
  );
}

export default App;
