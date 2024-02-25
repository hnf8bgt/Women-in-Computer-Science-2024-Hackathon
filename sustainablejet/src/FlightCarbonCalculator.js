import React, { useEffect, useState } from 'react';
import axios from 'axios';
import 'bulma/css/bulma.min.css';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import destIconImage from './location.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';


//icon for origin point
let DefaultIcon = L.icon({
      iconUrl: icon,
      iconSize: [24,36],
      iconAnchor: [12,36],
      shadowUrl: iconShadow
  });

// trying to change the icon of the destination
var destinationIcon = L.icon({
  iconUrl: destIconImage,
  iconSize: [45,48],
  iconAnchor: [12,36],
  shadowUrl: iconShadow
});


L.Marker.prototype.options.icon = DefaultIcon;

const FlightCarbonCalculator = () => {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [emissions, setEmissions] = useState(null);
  const [totalEmissions, setTotalEmissions] = useState(0);
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestinationDropdown, setShowDestinationDropdown] = useState(false);
  const [originPosition, setOriginPosition] = useState(null);
  const [roundTrip, setRoundTrip] = useState(false);
  const [saveBtnDisabled, setSaveBtnDisabled] = useState(true);
  const [destinationPosition, setDestinationPosition] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);

  useEffect(() => {
    let te = localStorage.getItem('totalEmissions');
    if (!isNaN(te) && te > 0) setTotalEmissions(parseFloat(te));
  }, [])  

  useEffect(() => {
    localStorage.setItem('totalEmissions', totalEmissions)
  }, [totalEmissions])

  const fetchSuggestions = async (value, isOrigin) => {
    try {
      const response = await axios.get(`http://autocomplete.travelpayouts.com/places2?term=${value}&locale=en&types[]=airport`);
      if (isOrigin) {
        setOriginSuggestions(response.data.slice(0, 10));
      } else {
        setDestinationSuggestions(response.data.slice(0, 10));
      }
    } catch (error) {
      console.error(`Error fetching ${isOrigin ? 'origin' : 'destination'} airport suggestions:`, error);
    }
  };

  const handleSelection = async (code, isOrigin) => {
    const setter = isOrigin ? setOrigin : setDestination;
    const positionSetter = isOrigin ? setOriginPosition : setDestinationPosition;
  
    setter(code.toUpperCase());
  
    try {
      const response = await axios.get(`http://autocomplete.travelpayouts.com/places2?term=${code}&locale=en&types[]=airport`);
      if (response.data && response.data.length > 0) {
        const { lon, lat } = response.data[0].coordinates;
        positionSetter([parseFloat(lat), parseFloat(lon)]);
      }
    } catch (error) {
      console.error('Error fetching coordinates:', error);
    }
  
    if (isOrigin) {
      setShowOriginDropdown(false);
    } else {
      setShowDestinationDropdown(false);
    }
  };

  const calculateEmissions = async () => {
    try {
      console.log('Calculating emissions...');

      const response = await axios.post('https://www.carboninterface.com/api/v1/estimates', {
        type: 'flight',
        distance_unit: 'mi',
        legs: [{ departure_airport: origin, destination_airport: destination }]
      }, {
        headers: {
          'Authorization': 'Bearer p7naFkWOnxQ9ZZoeZUHhsw',
          'Content-Type': 'application/json'
        }
      });

      console.log('API Response:', response.data);

      const carbonEmissions = response.data.data.attributes.carbon_kg;
      if (roundTrip) setEmissions(carbonEmissions * 2);
      else setEmissions(carbonEmissions);
      setSaveBtnDisabled(false);
      // Fetch route coordinates
      fetchRouteCoordinates();
    } catch (error) {
      console.error('Error calculating emissions:', error);
    }
  };

  const fetchRouteCoordinates = async () => {
    try {
      const response = await axios.get(`https://api.openrouteservice.org/v2/directions/driving-car?api_key=5b3ce3597851110001cf62484d5f1a5b5cd2469b97c0908203f52c4e&start=${origin}&end=${destination}`);
      const route = response.data.features[0].geometry.coordinates;
      setRouteCoordinates(route.map(coord => [coord[1], coord[0]]));
    } catch (error) {
      console.error('Error fetching route coordinates:', error);
    }
  };

  return (
    <main className="container content p-4">
      <h1>✈ Flight Carbon Calculator • Total: {Math.round(totalEmissions * 100) / 100} kg</h1>
      
      <div className='field is-grouped'>
        <p className='control'>
          <input
            type="text"
            placeholder="Origin Airport"
            value={origin}
            className='input'
            spellCheck='false'
            onChange={(e) => {
              setOrigin(e.target.value);
              setShowOriginDropdown(true);
              fetchSuggestions(e.target.value, true);
            }}
          />
          {showOriginDropdown && (
            <div className="field has-addons">
              {originSuggestions.map(suggestion => (
                <p className='control'>
                <button
                  key={suggestion.code}
                  className="button is-small"
                  onClick={() => handleSelection(suggestion.code, true)}
                >
                  {suggestion.code} • {suggestion.name}
                </button>
                </p>
              ))}
            </div>
          )}
        </p>
        <p className='control'><button className='button' title='Switch between ➔ (one way) and ⮂ (round trip)' onClick={()=>setRoundTrip(!roundTrip)}><span className='icon-text'><span className='icon is-medium'><b>{roundTrip ? '⮂' : '➔'}</b></span></span></button></p>
        <p className='control'>
          <input
            type="text"
            placeholder="Destination Airport"
            value={destination}
            className='input'
            spellCheck='false'
            onChange={(e) => {
              //L.icon.iconUrl: 'location.png';
              setDestination(e.target.value);
              setShowDestinationDropdown(true);
              fetchSuggestions(e.target.value, false);
            }}
          />
          {showDestinationDropdown && (
            <div className="field has-addons">
              {destinationSuggestions.map(suggestion => (
                <button
                  key={suggestion.code}
                  className="button is-small"
                  onClick={() => handleSelection(suggestion.code, false)}
                >
                  {suggestion.code} - {suggestion.name}
                </button>
              ))}
            </div>
          )}
        </p>
      <button className='button is-success l-4 r-4' onClick={calculateEmissions}>⫸ Calculate Emissions</button>
      </div>
      <div className='pb-0 is-flex is-align-content-center'>
        {emissions !== null && (
          <p className='is-size-4'>
            🌡️ <b>{emissions} kg</b> CO<sub>2</sub> •
            🌳 offset by <b>{Math.ceil(emissions / 20)} trees</b>&nbsp;&nbsp;
          </p>
        )}
        <button className='button' disabled={saveBtnDisabled} onClick={() => { setTotalEmissions(totalEmissions + emissions); setSaveBtnDisabled(true) }}>+ Save Trip</button>
        <button className='button' style={{ marginLeft: '10px' }} onClick={() => setTotalEmissions(0)}>- Clear Total</button>
      </div>

      <div style={{ height: '420px', marginTop: emissions ? '0px' : '15px'}}>
        <MapContainer attributionControl={false} center={[0, 0]} zoom={2} style={{ height: '100%', width: '100%', borderRadius: '4px' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {originPosition && <Marker position={originPosition}><Popup>{origin}</Popup></Marker>}
          {destinationPosition && <Marker position={destinationPosition} icon={destinationIcon}><Popup>{destination}</Popup></Marker>}
          {(originPosition && destinationPosition) && <Polyline positions={[originPosition, destinationPosition]} dashArray='5, 5' opacity={0.75}></Polyline>}
        </MapContainer>
      </div>
    </main>
  );
};

// <a href="https://www.flaticon.com/free-icons/marker" title="marker icons">Marker icons created by Freepik - Flaticon</a>

export default FlightCarbonCalculator;